import { prisma } from "@/lib/db";
import { getStoreFilter } from "@/lib/store-helper";
import { sortSidebarCategories } from "@/lib/category-sort";

/**
 * llms.txt / llms-full.txt ortak içeriği (yapay zeka modelleri için mağaza özeti).
 * Mağaza bilgileri kullanıcı onaylı (2026-10-24): bisikletlerde 2 yıl garanti; Bisan, Ümit, Corelli, Mosso yetkili satıcı;
 * kargo Sürat + DHL eCommerce; aynı gün kargo; 14 gün yasal cayma hakkı. Motor sitesinde bisiklete özel iddialar yazılmaz.
 */

export const STORE_PHONE = "0554 014 41 42";
export const STORE_EMAIL = "vitrinmoto@gmail.com";
export const STORE_ADDRESS = "Yazır Mahallesi Şafak Cad. No:32B Selçuklu / Konya";
export const LEGAL_TITLE = "Mehmet Fatih Bardakcı (Bardakcı Bike) - şahıs şirketi";
export const AUTHORIZED_BIKE_BRANDS = ["Bisan", "Ümit", "Corelli", "Mosso"];

// Admin'de veri hatası olarak kalmış, modele "marka" diye verilmemesi gereken adlar
const JUNK_BRANDS = new Set(["404", "diğer", "diger", "servis", "markasız", "markasiz", "bardakcı bike", "bardakci bike"]);

export interface LlmsContext {
    host: string;
    baseUrl: string;
    isMotor: boolean;
    store: "BIKE" | "MOTOR";
    storeFilter: any;
    siteName: string;
    sisterName: string;
    sisterUrl: string;
}

export function resolveLlmsContext(req: Request): LlmsContext {
    let host = "www.bardakcibike.com.tr";
    try {
        host = req.headers.get("x-forwarded-host") || req.headers.get("host") || host;
    } catch {}
    host = host.split(",")[0].trim();
    const isMotor = host.includes("motovitrin") || host.startsWith("motor.");
    const store = isMotor ? "MOTOR" : "BIKE";
    return {
        host,
        baseUrl: `https://${host}`,
        isMotor,
        store,
        storeFilter: getStoreFilter(store),
        siteName: isMotor ? "Moto Vitrin" : "Bardakcı Bike",
        sisterName: isMotor ? "Bardakcı Bike (bisiklet)" : "Moto Vitrin (motosiklet)",
        sisterUrl: isMotor ? "https://www.bardakcibike.com.tr" : "https://motor.bardakcibike.com.tr",
    };
}

/** "3.050,30 TL"; tam sayıda kuruşsuz "13.000 TL" */
export function formatPriceTr(val: unknown): string {
    const num = Number(val);
    if (!Number.isFinite(num)) return "-";
    const whole = Math.abs(num - Math.round(num)) < 0.005;
    return `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(num)} TL`;
}

export function stripHtml(html?: string | null): string {
    if (!html) return "";
    return html.replace(/<[^>]*>?/gm, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

/** Metni sınıra kadar, cümle sonundan keser (cümle ortasında "..." bırakmaz) */
export function shortText(text: string, max: number): string {
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    return end > max * 0.4 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

/** Başlık, özet, iletişim ve alışveriş koşulları (iki dosyada aynı) */
export function introLines(ctx: LlmsContext, title: string): string[] {
    const { isMotor, baseUrl, host, siteName } = ctx;
    const summary = isMotor
        ? "Moto Vitrin, Konya Selçuklu'daki mağaza ve deposundan Türkiye geneline motosiklet yedek parçası, aksesuarı ve ekipmanı satan online mağazadır. Ürünler modele göre (Mondial, CG, Falcon, Honda, Yamaha vb.) kategorilenmiştir."
        : `Bardakcı Bike, Konya Selçuklu'daki mağaza ve deposundan Türkiye geneline bisiklet, elektrikli bisiklet, çocuk bisikleti, yedek parça ve aksesuar satan online mağazadır. ${AUTHORIZED_BIKE_BRANDS.join(", ")} markalarının yetkili satıcısıdır.`;

    const lines = [`# ${title}`, "", `> ${summary}`, ""];

    lines.push("## Mağaza ve İletişim");
    lines.push(`- **Mağaza:** ${siteName} — [${host}](${baseUrl})`);
    lines.push(`- **Kardeş site:** ${ctx.sisterName} — ${ctx.sisterUrl} (aynı firma)`);
    lines.push(`- **Firma:** ${LEGAL_TITLE}`);
    lines.push(`- **Adres:** ${STORE_ADDRESS} (fiziksel mağaza ve depo)`);
    lines.push(`- **Telefon / WhatsApp:** ${STORE_PHONE}`);
    lines.push(`- **E-posta:** ${STORE_EMAIL}`);
    lines.push("- **Çalışma saatleri:** Pazartesi–Cumartesi 09:00–18:00");
    lines.push("");

    lines.push("## Alışveriş Koşulları");
    if (!isMotor) {
        lines.push("- **Kargo ücreti:** Tüm bisikletlerde Türkiye geneli ücretsiz kargo. Yedek parça ve aksesuarlarda kargo ücreti ürünün desisine göre hesaplanır.");
    } else {
        lines.push("- **Kargo ücreti:** Ürünün desisine göre hesaplanır ve ödeme sayfasında gösterilir.");
    }
    lines.push("- **Kargo firmaları:** Sürat Kargo ve DHL eCommerce.");
    lines.push("- **Kargoya veriliş:** Aynı gün kargo; siparişler aynı gün kargoya teslim edilir.");
    lines.push("- **Ödeme:** Kredi kartı (PayTR güvencesiyle, 3D Secure, taksit seçenekleri) ve Havale/EFT.");
    lines.push("- **İade:** Mesafeli Sözleşmeler Yönetmeliği kapsamında teslimattan itibaren 14 gün içinde cayma (iade) hakkı.");
    if (!isMotor) {
        lines.push("- **Garanti:** Bisikletlerde 2 yıl üretici garantisi.");
        lines.push(`- **Yetkili satıcı:** ${AUTHORIZED_BIKE_BRANDS.join(", ")}.`);
    }
    lines.push("");
    return lines;
}

export interface LlmsCategory {
    name: string;
    slug: string;
    description: string | null;
    children: { name: string; slug: string }[];
}

/** Ana kategoriler (üst menü sırası önce) ve alt kategorileri (jant ölçüsüne göre sıralı) */
export async function getCategoryTree(ctx: LlmsContext): Promise<LlmsCategory[]> {
    const all = await prisma.category.findMany({
        where: { isActive: true, store: ctx.storeFilter as any },
        select: { id: true, name: true, slug: true, description: true, parentId: true, order: true, isInHeader: true, headerOrder: true },
    });
    const byId = new Map(all.map((c) => [c.id, c]));
    // Kök: üstü yok ya da üstü "Root/Home" gibi gizli kök kategori
    const isRootHolder = (name: string) => name === "Root" || name === "Home";
    const roots = all.filter((c) => {
        if (isRootHolder(c.name)) return false;
        const parent = c.parentId ? byId.get(c.parentId) : undefined;
        return !parent || isRootHolder(parent.name);
    });
    roots.sort(
        (a, b) =>
            Number(b.isInHeader) - Number(a.isInHeader) ||
            (a.isInHeader ? a.headerOrder - b.headerOrder : 0) ||
            a.order - b.order ||
            a.name.localeCompare(b.name, "tr")
    );
    return roots.map((r) => ({
        name: r.name,
        slug: r.slug,
        description: r.description,
        children: sortSidebarCategories(all.filter((c) => c.parentId === r.id)).map((c) => ({ name: c.name, slug: c.slug })),
    }));
}

/** Bu mağazada aktif ürünü olan markalar (veri hatası adlar hariç) */
export async function getCatalogBrands(ctx: LlmsContext): Promise<string[]> {
    const brands = await prisma.brand.findMany({
        where: { isActive: true, products: { some: { isActive: true, store: ctx.storeFilter as any } } },
        orderBy: { name: "asc" },
        select: { name: true },
    });
    return brands.map((b) => b.name.trim()).filter((n) => n && !JUNK_BRANDS.has(n.toLocaleLowerCase("tr-TR")));
}

export function markdownResponse(body: string): Response {
    return new Response(body, {
        status: 200,
        headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
    });
}
