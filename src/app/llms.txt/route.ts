import { prisma } from "@/lib/db";
import { getStoreSettings, getStoreFilter } from "@/lib/store-helper";
import { getSiteSettings } from "@/lib/settings";
import { getAllFAQs } from "@/app/actions/faq";

export const revalidate = 3600; // 1 saat önbellekleme (ISR)

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

    // 1. Kategorileri Çek
    let categories: any[] = [];
    try {
        categories = await prisma.category.findMany({
            where: { isActive: true, store: storeFilter as any },
            orderBy: [{ order: "asc" }, { name: "asc" }],
            take: 20,
            select: { name: true, slug: true, description: true }
        });
    } catch (e) {
        console.warn("llms.txt category error:", e);
    }

    // 2. Öne Çıkan / Çok Satan Ürünleri Çek
    let products: any[] = [];
    try {
        products = await prisma.product.findMany({
            where: {
                isActive: true,
                store: storeFilter as any,
                stock: { gt: 0 }
            },
            orderBy: [
                { isBestSeller: "desc" },
                { isFeatured: "desc" },
                { updatedAt: "desc" }
            ],
            take: 25,
            select: {
                name: true,
                slug: true,
                sku: true,
                listPrice: true,
                salePrice: true,
                brakeType: true,
                gender: true,
                brand: { select: { name: true } },
                categories: { select: { name: true }, take: 1 }
            }
        });
    } catch (e) {
        console.warn("llms.txt product error:", e);
    }

    // 3. Markaları Çek
    let brands: any[] = [];
    try {
        brands = await prisma.brand.findMany({
            where: { isActive: true, store: storeFilter as any },
            orderBy: { name: "asc" },
            take: 30,
            select: { name: true, slug: true }
        });
    } catch (e) {
        console.warn("llms.txt brand error:", e);
    }

    // 4. Temel SSS Sorularını Çek
    let faqs: any[] = [];
    try {
        const allFaqs = await getAllFAQs(true, activeStore);
        faqs = (allFaqs || []).slice(0, 6);
    } catch (e) {
        console.warn("llms.txt faq error:", e);
    }

    // Markdown Oluşturma (llmstxt.org standardı)
    const isPlaceholder = (val?: string) => !val || val.includes("B2B") || val.includes("555 0000") || val.includes("b2b.com") || val === "İstanbul, Türkiye";

    const siteTitle = !isPlaceholder(storeSettings.siteTitle)
        ? storeSettings.siteTitle
        : (isMotor ? "Moto Vitrin" : "Bardakcı Bike");

    const brandName = "Moto Vitrin & Bardakcı Bike";
    const legalTitle = "Bardakcı Bike - Mehmet Fatih Bardakcı";
    const storePhone = "0554 014 41 42";
    const storeEmail = "vitrinmoto@gmail.com";
    const storeAddress = "Yazır Mahallesi Şafak Cad. No:32B Selçuklu / Konya";

    const summary = isMotor
        ? "Moto Vitrin (motovitrin.com), Konya Selçuklu merkezli mağazasıyla Türkiye genelinde orijinal motosiklet yedek parça, kask, mont ve aksesuar satışı yapan yetkili mağazadır."
        : "Bardakcı Bike & Moto Vitrin (bardakcibike.com.tr), Türkiye genelinde Bisan, Corelli, Mosso ve Ümit başta olmak üzere orijinal bisiklet, elektrikli bisiklet, yedek parça ve aksesuar satışı yapan Konya merkezli resmi yetkili satıcıdır.";

    const lines: string[] = [];

    // Başlık ve Özet (H1 + blockquote)
    lines.push(`# ${siteTitle} (${brandName})`);
    lines.push("");
    lines.push(`> ${summary}`);
    lines.push("");

    // Mağaza & İletişim
    lines.push("## Mağaza ve İletişim Bilgileri");
    lines.push(`- **Marka Adı:** ${brandName}`);
    lines.push(`- **Yasal Ticari Ünvan:** ${legalTitle}`);
    lines.push(`- **Açık Adres:** ${storeAddress}`);
    lines.push(`- **Telefon / WhatsApp:** ${storePhone}`);
    lines.push(`- **İletişim E-Posta:** ${storeEmail}`);
    lines.push(`- **Resmi Web Sitesi:** [${host}](${baseUrl})`);
    lines.push("");

    // Satış & Müşteri Politikaları
    lines.push("## Alışveriş ve Kargo Politikaları");
    lines.push("- **Bisikletlerde Kargo:** TÜM BİSİKLETLERDE TÜRKİYE GENELİ ÜCRETSİZ KARGO.");
    lines.push("- **Yedek Parça & Aksesuar Kargosu:** Yedek parça ve aksesuarlarda desi bazlı kargo ücreti hesaplanır.");
    lines.push("- **Anlaşmalı Kargo Firmaları:** Sürat Kargo ve DHL eCommerce Kargo.");
    lines.push("- **Teslimat Süresi:** Siparişler en geç 24 saat içinde güvenli ve sağlam paketlemeyle sevk edilir.");
    lines.push("- **İade ve Değişim:** Tüketici Hakları Kanunu kapsamında 14 gün içinde koşulsuz iade ve değişim hakkı mevcuttur.");
    lines.push("- **Ödeme Yöntemleri:** PayTR güvencesiyle tüm kredi kartlarına taksit, Havale/EFT ve 3D Secure güvenli ödeme seçenekleri.");
    lines.push("- **Garanti:** Satılan tüm bisikletler ve parçalar %100 orijinal olup 2 yıl resmi üretici garantisi altındadır.");
    lines.push("");

    // Kategoriler
    if (categories.length > 0) {
        lines.push("## Ana Ürün Kategorileri");
        for (const cat of categories) {
            const desc = cat.description ? ` - ${stripHtml(cat.description).slice(0, 100)}` : "";
            lines.push(`- [${cat.name}](${baseUrl}/category/${cat.slug})${desc}`);
        }
        lines.push("");
    }

    // Öne Çıkan Ürünler
    if (products.length > 0) {
        lines.push("## Popüler ve Öne Çıkan Ürünler");
        for (const p of products) {
            const price = p.salePrice && Number(p.salePrice) < Number(p.listPrice) ? formatPrice(p.salePrice) : formatPrice(p.listPrice);
            const brandStr = p.brand?.name ? ` | Marka: ${p.brand.name}` : "";
            const brakeStr = p.brakeType ? ` | Fren: ${p.brakeType}` : "";
            const catStr = p.categories?.[0]?.name ? ` (${p.categories[0].name})` : "";
            lines.push(`- [${p.name}](${baseUrl}/products/${p.slug}): ${price}${brandStr}${brakeStr}${catStr} - Stokta mevcut.`);
        }
        lines.push("");
    }

    // Markalar
    lines.push("## Öne Çıkan ve Yetkili Markalar");
    lines.push("- **Öncelikli Markalar:** Bisan, Corelli, Mosso, Ümit");
    if (brands.length > 0) {
        const brandNames = brands.map(b => b.name).join(", ");
        lines.push(`- **Katalog Markaları:** ${brandNames}`);
    }
    lines.push("");

    // Sıkça Sorulan Sorular
    if (faqs.length > 0) {
        lines.push("## Sıkça Sorulan Sorular (SSS)");
        for (const faq of faqs) {
            const q = faq.question;
            const a = stripHtml(faq.answer).slice(0, 200);
            lines.push(`- **Soru: ${q}**`);
            lines.push(`  - Cevap: ${a}...`);
        }
        lines.push("");
    }

    // Önemli Bağlantılar
    lines.push("## Kurumsal ve Bilgi Sayfaları");
    lines.push(`- [Sıkça Sorulan Sorular](${baseUrl}/sss): Kargo, montaj, garanti ve iade süreçleri.`);
    lines.push(`- [Hakkımızda](${baseUrl}/about): Şirket profili, vizyon ve yetkili bayi bilgileri.`);
    lines.push(`- [İletişim & Harita](${baseUrl}/contact): Mağaza adresi, telefon numaraları ve çalışma saatleri.`);
    lines.push(`- [İade ve İptal Koşulları](${baseUrl}/policies/cancellation): Cayma hakkı ve iade prosedürü.`);
    lines.push(`- [Gizlilik Politikası](${baseUrl}/policies/privacy): Kişisel verilerin korunması ve gizlilik taahhüdü.`);
    lines.push("");

    // Full LLM context linki
    lines.push("## Genişletilmiş Katalog (LLMs-Full)");
    lines.push(`- [Tüm Ürün Kataloğu ve Teknik Detaylar](${baseUrl}/llms-full.txt): Yapay zeka modelleri için sitenin kapsamlı ürün ve şartname dökümü.`);
    lines.push("");

    const markdownOutput = lines.join("\n");

    return new Response(markdownOutput, {
        status: 200,
        headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
    });
}
