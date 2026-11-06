import { prisma } from "@/lib/db";
import { autoMarketplacePrice } from "@/lib/marketplace-price-fill";

const MARKETPLACES = {
    trendyol: { price: "trendyolPrice", listing: "trendyolProduct" },
    hepsiburada: { price: "hepsiburadaPrice", listing: "hepsiburadaProduct" },
    n11: { price: "n11Price", listing: "n11Product" },
    idefix: { price: "idefixPrice", listing: "idefixProduct" },
    pazarama: { price: "pazaramaPrice", listing: "pazaramaProduct" },
    pttavm: { price: "pttavmPrice", listing: "pttavmProduct" },
    ciceksepeti: { price: "ciceksepetiPrice", listing: "ciceksepetiProduct" },
} as const;

/**
 * Pazaryeri ekranından elle gönderim: ürün kartı kaydedilmediği için boş kutu burada liste fiyatı + %50 ile doldurulur.
 * Kutuya yazıldığı için sonraki stok/fiyat senkronu da aynı fiyatı kullanır. İlanı olan ürüne dokunulmaz.
 * Sadece elle gönderimden çağrılmalı: stok senkronuna konursa yayındaki ilanların fiyatı toplu değişir.
 * Dönen metin başarı mesajının sonuna eklenir.
 */
export async function fillEmptyPriceOnSend(marketplace: keyof typeof MARKETPLACES, productIds: string[], extraWhere: Record<string, unknown> = {}): Promise<string> {
    const { price, listing } = MARKETPLACES[marketplace];
    const db = prisma as any;

    const products: any[] = await db.product.findMany({
        where: { ...extraWhere, id: { in: productIds }, listPrice: { gt: 0 }, OR: [{ [price]: null }, { [price]: { lte: 0 } }] },
        select: { id: true, listPrice: true, [listing]: { select: { isSynced: true } } },
    });
    const targets = products.filter((p) => !p[listing]?.isSynced);

    for (const p of targets) {
        await db.product.update({ where: { id: p.id }, data: { [price]: autoMarketplacePrice(p.listPrice) } });
    }

    if (targets.length === 0) return "";
    if (targets.length > 1) return ` ${targets.length} üründe fiyat boştu, liste fiyatı + %50 yazıldı.`;
    return ` Fiyat boştu, ${autoMarketplacePrice(targets[0].listPrice).toLocaleString("tr-TR")}₺ yazıldı (liste fiyatı + %50).`;
}
