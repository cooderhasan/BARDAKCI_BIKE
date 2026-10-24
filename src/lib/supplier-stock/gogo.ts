import { prisma } from "@/lib/db";

/**
 * Gogo Moto Aksesuar XML'inden motor sitesi stok güncellemesi.
 *
 * Kullanıcı Gogo ürünlerini siparişe göre günlük getiriyor: sitedeki stok = Gogo stoğu.
 * - Sadece motor sitesindeki (MOTOR/BOTH) ürünler, ürün kodu (sku) = XML stockCode ile eşleşir; barkodlar farklı.
 * - XML'de olup sitede olmayan atlanır; sitede olup XML'de olmayana dokunulmaz. Fiyata dokunulmaz.
 * - XML'de durumu aktif ("1") olmayan ürün stok 0 sayılır.
 * - Varyantlı ve set (bundle) ürünler atlanır.
 * - XML bağlantısı Gogo'nun müşteriye özel linki: koda yazılmaz, SiteSettings'te (admin ekranından) tutulur.
 */

export const GOGO_SETTINGS_KEY = "supplier_gogo";

export interface GogoSettings {
    url?: string;
    enabled?: boolean; // otomatik günlük çalışma
    lastRunAt?: string;
    lastReport?: GogoReport;
}

export interface GogoChange {
    id: string;
    sku: string;
    name: string;
    from: number;
    to: number;
}

export interface GogoReport {
    dryRun: boolean;
    xmlCount: number;
    siteProducts: number;
    matched: number;
    changed: number;
    toZero: number;
    applied: boolean;
    message: string;
    sample: GogoChange[];
    finishedAt: string;
}

// Bozuk / yarım XML'e karşı: bundan az ürün gelirse hiçbir şey yapılmaz
const MIN_XML_ITEMS = 1000;
// Eşleşen ürünlerin bu oranından fazlası bir anda 0'a düşecekse durdur (Gogo tarafında hata olabilir)
const MAX_ZERO_RATIO = 0.6;

const norm = (code: string) => code.trim().toLocaleUpperCase("tr-TR");

function tagValue(block: string, tag: string): string | null {
    const m = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`));
    return m ? m[1].trim() : null;
}

/** XML'i akış halinde okur (dosya ~90 MB; açıklamalar belleğe toplanmaz): kod -> stok */
export async function fetchGogoStocks(url: string): Promise<Map<string, number>> {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok || !res.body) throw new Error(`Gogo XML indirilemedi (HTTP ${res.status}).`);

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    const stocks = new Map<string, number>();
    let buf = "";
    for (;;) {
        const { value, done } = await reader.read();
        if (value) buf += value;
        let end: number;
        while ((end = buf.indexOf("</item>")) !== -1) {
            const start = buf.lastIndexOf("<item>", end);
            const block = start >= 0 ? buf.slice(start, end) : "";
            buf = buf.slice(end + 7);
            // Sadece ana ürün alanları (varyant alanları vStockCode/vStockAmount ayrı etiket)
            const code = tagValue(block, "stockCode");
            if (!code) continue;
            const status = tagValue(block, "status");
            const amount = Number(String(tagValue(block, "stockAmount") || "0").replace(",", "."));
            const stock = status === "1" && Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
            stocks.set(norm(code), stock);
        }
        if (done) break;
    }
    return stocks;
}

export async function getGogoSettings(): Promise<GogoSettings> {
    const row = await prisma.siteSettings.findUnique({ where: { key: GOGO_SETTINGS_KEY } });
    return ((row?.value as any) || {}) as GogoSettings;
}

export async function saveGogoSettings(patch: Partial<GogoSettings>): Promise<GogoSettings> {
    const current = await getGogoSettings();
    const next = { ...current, ...patch };
    await prisma.siteSettings.upsert({
        where: { key: GOGO_SETTINGS_KEY },
        update: { value: next as any },
        create: { key: GOGO_SETTINGS_KEY, value: next as any },
    });
    return next;
}

/** Önizleme (dryRun) ya da uygulama. Uygulamada stok yazılır, setler yeniden hesaplanır, pazaryerlerine gönderilir. */
export async function runGogoStockSync({ dryRun }: { dryRun: boolean }): Promise<GogoReport> {
    const settings = await getGogoSettings();
    if (!settings.url) throw new Error("Gogo XML bağlantısı girilmemiş.");

    const stocks = await fetchGogoStocks(settings.url);
    const finish = async (report: Omit<GogoReport, "finishedAt">) => {
        const full = { ...report, finishedAt: new Date().toISOString() };
        await saveGogoSettings({ lastRunAt: full.finishedAt, lastReport: full });
        return full;
    };

    if (stocks.size < MIN_XML_ITEMS) {
        return finish({
            dryRun, xmlCount: stocks.size, siteProducts: 0, matched: 0, changed: 0, toZero: 0, applied: false, sample: [],
            message: `XML'de sadece ${stocks.size} ürün okundu; dosya eksik/bozuk olabilir. Hiçbir stok değiştirilmedi.`,
        });
    }

    const products = await prisma.product.findMany({
        where: { store: { in: ["MOTOR", "BOTH"] as any }, sku: { not: "" }, isBundle: false },
        select: { id: true, sku: true, name: true, stock: true, _count: { select: { variants: true } } },
    });

    const changes: GogoChange[] = [];
    let matched = 0;
    for (const p of products) {
        if (!p.sku || p._count.variants > 0) continue;
        const target = stocks.get(norm(p.sku));
        if (target === undefined) continue;
        matched++;
        if (target !== p.stock) changes.push({ id: p.id, sku: p.sku, name: p.name, from: p.stock, to: target });
    }
    const toZero = changes.filter((c) => c.to === 0 && c.from > 0).length;
    const sample = changes.slice(0, 300);
    const base = { dryRun, xmlCount: stocks.size, siteProducts: products.length, matched, changed: changes.length, toZero, sample };

    if (matched > 0 && toZero / matched > MAX_ZERO_RATIO) {
        return finish({
            ...base, applied: false,
            message: `Eşleşen ${matched} ürünün ${toZero} tanesi bir anda 0'a düşecekti; Gogo XML'inde sorun olabilir. Güvenlik için durduruldu.`,
        });
    }

    if (dryRun || changes.length === 0) {
        return finish({
            ...base, applied: false,
            message: changes.length === 0 ? "Değişen stok yok." : `${changes.length} ürünün stoğu değişecek (önizleme, henüz uygulanmadı).`,
        });
    }

    // Uygula: küçük gruplar halinde yaz
    for (let i = 0; i < changes.length; i += 200) {
        const chunk = changes.slice(i, i + 200);
        await prisma.$transaction(chunk.map((c) => prisma.product.update({ where: { id: c.id }, data: { stock: c.to } })));
    }
    const ids = changes.map((c) => c.id);
    const { recalcBundleStocks, handlePostOrderStockSync } = await import("@/lib/stock-sync");
    const bundleIds = await recalcBundleStocks(prisma, ids).catch(() => [] as string[]);
    // Pazaryerlerine stok (kritik stok kuralı dahil)
    handlePostOrderStockSync([...new Set([...ids, ...bundleIds])], "site").catch(console.error);

    return finish({ ...base, applied: true, message: `${changes.length} ürünün stoğu güncellendi ve pazaryerlerine gönderildi.` });
}
