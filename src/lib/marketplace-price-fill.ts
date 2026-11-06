// Pazaryeri fiyatı unutulursa boş kutu liste fiyatının bu katıyla doldurulur (liste fiyatı komisyonsuz olduğu için zarar ettirir)
const EMPTY_PRICE_MULTIPLIER = 1.5;

const MARKETPLACE_FIELDS = [
    { price: "trendyolPrice", active: "isTrendyolActive", label: "Trendyol" },
    { price: "n11Price", active: "isN11Active", label: "N11" },
    { price: "hepsiburadaPrice", active: "isHepsiburadaActive", label: "Hepsiburada" },
    { price: "idefixPrice", active: "isIdefixActive", label: "İdefix" },
    { price: "pazaramaPrice", active: "isPazaramaActive", label: "Pazarama" },
    { price: "pttavmPrice", active: "isPttavmActive", label: "ePttAVM" },
    { price: "ciceksepetiPrice", active: "isCiceksepetiActive", label: "Çiçeksepeti" },
];

/** Boş bırakılan pazaryeri fiyatının yerine yazılacak tutar */
export function autoMarketplacePrice(listPrice: unknown): number {
    return Math.round(Number(listPrice) * EMPTY_PRICE_MULTIPLIER * 100) / 100;
}

/**
 * Daha önce de tiki açık ve fiyatı boş olan ürün: liste fiyatıyla yayında olabilir, kendiliğinden fiyatı artırılmaz.
 * Bu ürünler "Bağlı Ama Fiyatı Girilmemiş" filtresiyle bulunup elle düzeltilir.
 */
export function keepsListPrice(old: Record<string, any> | null | undefined, field: { price: string; active: string }): boolean {
    return !!old?.[field.active] && !(Number(old[field.price]) > 0);
}

/**
 * Tiki açık, fiyatı boş pazaryerleri için yazılacak fiyatları döner. Tiki kapalı olana ve girilmiş fiyata dokunmaz.
 * old: düzenlenen ürünün kayıtlı hali (yeni üründe boş).
 */
export function fillEmptyMarketplacePrices(data: Record<string, any>, old?: Record<string, any> | null) {
    const filled: Record<string, number> = {};
    const labels: string[] = [];
    const price = autoMarketplacePrice(data.listPrice);
    if (!(price > 0)) return { filled, labels, price };

    for (const field of MARKETPLACE_FIELDS) {
        if (!data[field.active] || Number(data[field.price]) > 0 || keepsListPrice(old, field)) continue;
        filled[field.price] = price;
        labels.push(field.label);
    }
    return { filled, labels, price };
}
