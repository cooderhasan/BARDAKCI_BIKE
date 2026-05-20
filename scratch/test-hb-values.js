const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        console.log("1. Hepsiburada yapılandırması alınıyor...");
        const config = await prisma.hepsiburadaConfig.findFirst({ where: { isActive: true } });
        if (!config) {
            console.error("❌ Hepsiburada yapılandırması bulunamadı!");
            return;
        }
        console.log("✅ Yapılandırma yüklendi. Merchant ID:", config.merchantId);

        console.log("2. HB kategorisi eşleşmiş olan yerel bir kategori aranıyor...");
        const categories = await prisma.category.findMany({
            where: { hbCategoryId: { not: null } },
            take: 5
        });

        if (categories.length === 0) {
            console.warn("⚠️ HB eşleşmeli kategori veritabanında bulunamadı. Sabit bir kategori ID'si (örn: 34) kullanılacak.");
        }

        const categoryId = categories[0]?.hbCategoryId || "34"; // Standart bir oto/motosiklet kategorisi veya mevcut olan
        const attributeId = "Renk"; // Genelde en çok seçenek içeren nitelik
        console.log(`📡 Kategori ID: ${categoryId}, Nitelik ID: ${attributeId}`);

        const sitSuffix = config.isTestMode ? "-sit" : "";
        const authPair = `${config.username}:${config.password}`;
        const headers = {
            "Authorization": `Basic ${Buffer.from(authPair).toString("base64")}`,
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "serinmotor_dev",
        };

        // 1. Durum: Parametresiz İstek (Şu anki durum)
        const urlDefault = `https://mpop${sitSuffix}.hepsiburada.com/product/api/categories/${categoryId}/attribute/${attributeId}/values`;
        console.log(`\n🔍 Deneme 1 (Parametresiz): ${urlDefault}`);
        const resDefault = await fetch(urlDefault, { headers });
        console.log(`Yanıt Durumu: ${resDefault.status}`);
        if (resDefault.ok) {
            const data = await resDefault.json();
            console.log(`Dönen veri tipi: ${typeof data} (Array mi: ${Array.isArray(data)})`);
            if (Array.isArray(data)) {
                console.log(`Toplam Değer Sayısı: ${data.length}`);
                console.log("İlk 5 değer:", JSON.stringify(data.slice(0, 5), null, 2));
            } else {
                console.log("Dönen Obje:", JSON.stringify(data).substring(0, 300));
            }
        } else {
            console.error("Hata:", await resDefault.text());
        }

        // 2. Durum: ?size=5000 Parametresi ile İstek
        const urlWithParams = `https://mpop${sitSuffix}.hepsiburada.com/product/api/categories/${categoryId}/attribute/${attributeId}/values?page=0&size=5000`;
        console.log(`\n🔍 Deneme 2 (?page=0&size=5000): ${urlWithParams}`);
        const resParams = await fetch(urlWithParams, { headers });
        console.log(`Yanıt Durumu: ${resParams.status}`);
        if (resParams.ok) {
            const data = await resParams.json();
            console.log(`Dönen veri tipi: ${typeof data} (Array mi: ${Array.isArray(data)})`);
            if (Array.isArray(data)) {
                console.log(`Toplam Değer Sayısı: ${data.length}`);
                console.log("İlk 5 değer:", JSON.stringify(data.slice(0, 5), null, 2));
                const hasChina = data.some(v => v.value?.toLowerCase().includes("çin") || v.value?.toLowerCase().includes("china"));
                const hasBlack = data.some(v => v.value?.toLowerCase() === "siyah" || v.value?.toLowerCase() === "black");
                console.log(`\n🔍 Değer Kontrolü (size=5000):`);
                console.log(`- İçinde 'Çin' geçen değer var mı? ${hasChina ? "EVET ✅" : "HAYIR ❌"}`);
                console.log(`- Tam 'Siyah' değeri var mı? ${hasBlack ? "EVET ✅" : "HAYIR ❌"}`);
            } else {
                console.log("Dönen Obje:", JSON.stringify(data).substring(0, 300));
            }
        } else {
            console.error("Hata:", await resParams.text());
        }

    } catch (err) {
        console.error("Hata oluştu:", err);
    } finally {
        await prisma.$disconnect();
    }
}

run();
