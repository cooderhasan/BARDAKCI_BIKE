import { prisma } from "@/lib/db";

type CodeVariant = { sku?: string | null; barcode?: string | null };

type CodeCheckInput = {
    /** Yeni ürün eklenirken boş */
    productId?: string;
    sku?: string | null;
    barcode?: string | null;
    variants?: CodeVariant[];
};

const normalize = (code?: string | null) => (code ?? "").trim().toLowerCase();

/**
 * Yeni girilen stok kodu / barkod başka bir üründe veya varyantında varsa uyarı metni döner, sorun yoksa null.
 * Ürünün zaten sahip olduğu kodlara bakılmaz: mevcut çakışmalar eski ürünlerin kaydedilmesini engellemesin.
 * Büyük/küçük harf ve baştaki/sondaki boşluk fark etmez. Stok kodu stok koduyla, barkod barkodla karşılaştırılır.
 */
export async function findProductCodeConflict({ productId, sku, barcode, variants = [] }: CodeCheckInput): Promise<string | null> {
    const old = productId
        ? await prisma.product.findUnique({
              where: { id: productId },
              select: { sku: true, barcode: true, variants: { select: { sku: true, barcode: true } } },
          })
        : null;

    const fields = [
        { key: "sku", label: "stok kodu", own: sku },
        { key: "barcode", label: "barkod", own: barcode },
    ] as const;

    for (const { key, label, own } of fields) {
        const oldCodes = new Set([old?.[key], ...(old?.variants ?? []).map((v) => v[key])].map(normalize));
        const isNew = (code: string) => !!code && !oldCodes.has(code);

        // Formda iki varyanta aynı kod yazılmışsa
        const variantCodes = variants.map((v) => normalize(v[key])).filter(isNew);
        const repeated = variantCodes.find((code, i) => variantCodes.indexOf(code) !== i);
        if (repeated) return `Aynı ${label} iki varyantta girilmiş: ${repeated}`;

        const entered = [...new Set([own, ...variants.map((v) => v[key])].map((c) => (c ?? "").trim()))].filter((c) => isNew(c.toLowerCase()));
        if (entered.length === 0) continue;

        // contains: kayıtlı kodun sonunda boşluk varsa da yakalasın; kesin eşleşme aşağıda bakılır
        const where: any = { OR: entered.map((code) => ({ [key]: { contains: code, mode: "insensitive" } })) };
        const [products, variantRows] = await Promise.all([
            prisma.product.findMany({ where: { ...where, ...(productId ? { id: { not: productId } } : {}) }, select: { name: true, sku: true, barcode: true } }),
            prisma.productVariant.findMany({
                where: { ...where, ...(productId ? { productId: { not: productId } } : {}) },
                select: { sku: true, barcode: true, product: { select: { name: true } } },
            }),
        ]);

        const wanted = new Set(entered.map(normalize));
        const productHit = products.find((p) => wanted.has(normalize(p[key])));
        if (productHit) return `Bu ${label} zaten kullanılıyor: ${productHit[key]?.trim()} (${productHit.name})`;
        const variantHit = variantRows.find((v) => wanted.has(normalize(v[key])));
        if (variantHit) return `Bu ${label} zaten kullanılıyor: ${variantHit[key]?.trim()} (${variantHit.product.name} ürününün varyantı)`;
    }

    return null;
}
