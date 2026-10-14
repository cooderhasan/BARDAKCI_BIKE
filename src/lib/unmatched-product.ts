import { prisma } from "@/lib/db";

/**
 * Pazaryeri siparişinde sitede karşılığı bulunamayan kalemler bu yer tutucu ürüne bağlanır
 * (Entegra'daki "Tanımsız Ürün" gibi). Sipariş kalemi bir ürüne bağlı olmak zorunda olduğu için var.
 * Pasif (sitede görünmez), hiçbir pazaryerine gönderilmez; kalemler stockDeducted=false ile yazılır, stoğuna dokunulmaz.
 * İlk ihtiyaçta otomatik oluşturulur.
 */
const UNMATCHED_SLUG = "tanimsiz-urun-pazaryeri";

export async function getUnmatchedProduct() {
    const existing = await prisma.product.findUnique({ where: { slug: UNMATCHED_SLUG } });
    if (existing) return existing;
    try {
        return await prisma.product.create({
            data: {
                name: "Tanımsız Ürün (Pazaryeri)",
                slug: UNMATCHED_SLUG,
                sku: "TANIMSIZ-URUN",
                listPrice: 0,
                stock: 0,
                criticalStock: 0,
                isActive: false,
                store: "BOTH",
            },
        });
    } catch {
        // Aynı anda iki sipariş aktarımı oluşturmaya çalıştıysa diğerinin oluşturduğunu kullan
        return prisma.product.findUniqueOrThrow({ where: { slug: UNMATCHED_SLUG } });
    }
}
