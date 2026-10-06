import { prisma } from "@/lib/db";
import { getStoreSettings, getStoreFilter } from "@/lib/store-helper";
import { getSiteSettings } from "@/lib/settings";
import { getAllFAQs } from "@/app/actions/faq";

export const revalidate = 3600; // 1 saat önbellek

function stripHtml(html?: string | null): string {
    if (!html) return "";
    return html.replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim();
}

function formatPrice(val: any): string {
    const num = Number(val);
    if (isNaN(num)) return "0 TL";
    return `${new Intl.NumberFormat("tr-TR").format(num)} TL`;
}

export async function GET(req: Request) {
    let host = "www.bardakcibike.com.tr";
    try {
        if (req && req.headers) {
            host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "www.bardakcibike.com.tr";
        }
    } catch {}
    const baseUrl = `https://${host}`;

    const activeStore = (host.includes("motovitrin") || host.startsWith("motor.")) ? "MOTOR" : "BIKE";
    const isMotor = activeStore === "MOTOR";
    const storeFilter = getStoreFilter(activeStore);

    const storeSettings = await getStoreSettings(activeStore);
    const generalSettings = await getSiteSettings();
    const freeShippingLimit = Number(generalSettings.freeShippingLimit) || 20000;

    // 1. Kategoriler
    let categories: any[] = [];
    try {
        categories = await prisma.category.findMany({
            where: { isActive: true, store: storeFilter as any },
            orderBy: [{ order: "asc" }, { name: "asc" }],
            select: { id: true, name: true, slug: true, description: true }
        });
    } catch (e) {
        console.warn("llms-full.txt category error:", e);
    }

    // 2. Kapsamlı Ürün Listesi (150 ürün)
    let products: any[] = [];
    try {
        products = await prisma.product.findMany({
            where: {
                isActive: true,
                store: storeFilter as any,
            },
            orderBy: [
                { stock: "desc" },
                { isBestSeller: "desc" },
                { updatedAt: "desc" }
            ],
            take: 150,
            select: {
                name: true,
                slug: true,
                sku: true,
                barcode: true,
                listPrice: true,
                salePrice: true,
                stock: true,
                brakeType: true,
                gender: true,
                description: true,
                brand: { select: { name: true } },
                categories: { select: { name: true }, take: 1 }
            }
        });
    } catch (e) {
        console.warn("llms-full.txt products error:", e);
    }

    // 3. Markalar
    let brands: any[] = [];
    try {
        brands = await prisma.brand.findMany({
            where: { isActive: true, store: storeFilter as any },
            orderBy: { name: "asc" },
            select: { name: true, slug: true }
        });
    } catch (e) {
        console.warn("llms-full.txt brands error:", e);
    }

    // 4. Tüm SSS
    let faqs: any[] = [];
    try {
        faqs = await getAllFAQs(true, activeStore);
    } catch (e) {
        console.warn("llms-full.txt faqs error:", e);
    }

    const isPlaceholder = (val?: string) => !val || val.includes("B2B") || val.includes("555 0000") || val.includes("b2b.com") || val === "İstanbul, Türkiye";

    const siteTitle = !isPlaceholder(storeSettings.siteTitle)
        ? storeSettings.siteTitle
        : (isMotor ? "Moto Vitrin" : "Bardakcı Bike");

    const brandName = "Moto Vitrin & Bardakcı Bike";
    const legalTitle = "Bardakcı Bike - Mehmet Fatih Bardakcı";
    const storePhone = "0554 014 41 42";
    const storeEmail = "vitrinmoto@gmail.com";
    const storeAddress = "Yazır Mahallesi Şafak Cad. No:32B Selçuklu / Konya";

    const lines: string[] = [];

    lines.push(`# ${siteTitle} (${brandName}) - Kapsamlı Ürün ve Hizmet Şartnamesi (Full LLM Context)`);
    lines.push("");
    lines.push(`> Bu dosya yapay zeka modelleri (ChatGPT, Gemini, Claude, Perplexity vb.) ve arama motorları için hazırlanmış tam kapsamlı katalog ve bilgi kaynağıdır.`);
    lines.push("");

    // Firma ve Mağaza Bilgileri
    lines.push("## Firma, Mağaza ve İletişim Bilgileri");
    lines.push(`- **Marka Adı:** ${brandName}`);
    lines.push(`- **Yasal Ticari Ünvan:** ${legalTitle}`);
    lines.push(`- **Açık Adres:** ${storeAddress}`);
    lines.push(`- **Müşteri Hizmetleri / WhatsApp:** ${storePhone}`);
    lines.push(`- **İletişim E-Posta:** ${storeEmail}`);
    lines.push(`- **Web Sitesi:** ${baseUrl}`);
    lines.push("- **Kargo Politikası:** TÜM BİSİKLETLERDE TÜRKİYE GENELİ ÜCRETSİZ KARGO. Yedek parça ve aksesuarlarda desi bazlı kargo ücretlendirmesi uygulanır.");
    lines.push("- **Anlaşmalı Kargo Firmaları:** Sürat Kargo ve DHL eCommerce Kargo.");
    lines.push("- **Teslimat Süresi:** Siparişler en geç 24 saat içinde kargolanır.");
    lines.push("- **Garanti:** Tüm bisiklet ve ekipmanlar 2 yıl resmi distribütör garantilidir.");
    lines.push("- **İade Şartları:** 14 gün koşulsuz iade ve değişim hakkı.");
    lines.push("");

    // Kategoriler Dökümü
    lines.push("## Aktif Ürün Kategorileri");
    for (const cat of categories) {
        const desc = cat.description ? ` - ${stripHtml(cat.description)}` : "";
        lines.push(`- [${cat.name}](${baseUrl}/category/${cat.slug})${desc}`);
    }
    lines.push("");

    // Markalar Dökümü
    lines.push("## Markalar Listesi");
    lines.push("- **Öncelikli Markalar:** Bisan, Corelli, Mosso, Ümit");
    if (brands.length > 0) {
        lines.push(`- **Katalog Markaları:** ${brands.map(b => b.name).join(", ")}`);
    }
    lines.push("");

    // Kapsamlı Ürün Listesi
    lines.push("## Ürün Kataloğu ve Teknik Özellikler");
    for (const p of products) {
        const isDiscounted = p.salePrice && Number(p.salePrice) < Number(p.listPrice) && Number(p.salePrice) > 0;
        const price = isDiscounted ? `${formatPrice(p.salePrice)} (İndirimli! Normal Fiyat: ${formatPrice(p.listPrice)})` : formatPrice(p.listPrice);
        const stockStatus = p.stock > 0 ? `Stokta Var (${p.stock} Adet)` : "Tükendi / Stokta Yok";
        const brandName = p.brand?.name ? p.brand.name : "Bardakcı Bike";
        const catName = p.categories?.[0]?.name ? p.categories[0].name : "Bisiklet & Parça";
        const specs: string[] = [];
        if (p.brakeType) specs.push(`Fren: ${p.brakeType}`);
        if (p.gender) specs.push(`Uygunluk: ${p.gender}`);
        if (p.sku) specs.push(`SKU: ${p.sku}`);

        lines.push(`### [${p.name}](${baseUrl}/products/${p.slug})`);
        lines.push(`- **Kategori:** ${catName} | **Marka:** ${brandName}`);
        lines.push(`- **Fiyat:** ${price} | **Durum:** ${stockStatus}`);
        if (specs.length > 0) {
            lines.push(`- **Özellikler:** ${specs.join(" | ")}`);
        }
        if (p.description) {
            const cleanDesc = stripHtml(p.description).slice(0, 250);
            if (cleanDesc) {
                lines.push(`- **Açıklama:** ${cleanDesc}...`);
            }
        }
        lines.push("");
    }

    // Tam SSS Listesi
    if (faqs.length > 0) {
        lines.push("## Sıkça Sorulan Sorular ve Yanıtları (Müşteri Rehberi)");
        for (const faq of faqs) {
            lines.push(`### Soru: ${faq.question}`);
            lines.push(`${stripHtml(faq.answer)}`);
            lines.push("");
        }
    }

    const markdownOutput = lines.join("\n");

    return new Response(markdownOutput, {
        status: 200,
        headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
    });
}
