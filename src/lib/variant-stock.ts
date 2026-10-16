/**
 * Varyantlı ürünlerde stok varyantlarda tutulur; ana ürün stoğu (products.stock) = aktif varyant stoklarının toplamı.
 * Önceden ana stok hiç güncellenmiyordu (0 kalıyordu): ürün sitede "Tükendi" görünüyor, "stoktakiler" filtresinde gizleniyor,
 * Google feed'e "stokta yok" gidiyordu. Pazaryerlerine her varyant zaten kendi stoğuyla gider; bu toplam sadece özet içindir.
 */
export async function recalcVariantParentStocks(db: any, productIds: string[]): Promise<void> {
    const ids = [...new Set(productIds.filter(Boolean))];
    if (ids.length === 0) return;
    const withVariants = await db.productVariant.findMany({
        where: { productId: { in: ids } },
        select: { productId: true, stock: true, isActive: true },
    });
    const totals = new Map<string, number>();
    for (const v of withVariants) {
        totals.set(v.productId, (totals.get(v.productId) || 0) + (v.isActive ? v.stock : 0));
    }
    for (const [productId, total] of totals) {
        await db.product.updateMany({ where: { id: productId, isBundle: false, NOT: { stock: total } }, data: { stock: total } });
    }
}

/** Tüm varyantlı ürünlerin ana stoğunu düzeltir (deploy sonrası bir kez; değişmeyenlere dokunmaz) */
export async function syncAllVariantParentStocks(db: any): Promise<number> {
    const rows = await db.productVariant.groupBy({ by: ["productId"] });
    const ids = rows.map((r: any) => r.productId);
    for (let i = 0; i < ids.length; i += 200) {
        await recalcVariantParentStocks(db, ids.slice(i, i + 200));
    }
    return ids.length;
}
