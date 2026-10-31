/**
 * Desi Bazlı Kargo Ücreti Hesaplama Modülü
 * 
 * Desi = (En × Boy × Yükseklik) / 3000
 * Kargo firmaları desi veya ağırlıktan büyük olanı baz alır.
 */

export interface DesiPriceRange {
    id: string;
    minDesi: number;
    maxDesi: number;
    price: number;
    multiplierType: "FIXED" | "MULTIPLY"; // Sabit Değer veya Katsayı ile Çarp
}

/**
 * Hacimsel desi hesaplama
 * @param width Genişlik (cm)
 * @param height Yükseklik (cm) 
 * @param length Uzunluk (cm)
 * @returns Hesaplanan desi değeri
 */
export function calculateDesi(width: number, height: number, length: number): number {
    if (width <= 0 || height <= 0 || length <= 0) return 0;
    return Math.ceil((width * height * length) / 3000 * 100) / 100; // 2 ondalık basamak
}

/**
 * Efektif desi — ağırlık ve hacimsel desiden büyük olanı döner
 * Kargo firmaları her zaman büyük olan değeri baz alır
 * @param weight Ağırlık (kg)
 * @param desi Hacimsel veya manuel desi
 * @returns Büyük olan değer
 */
export function getEffectiveDesi(weight: number | null | undefined, desi: number | null | undefined): number {
    const w = weight ?? 0;
    const d = desi ?? 0;
    return Math.max(w, d);
}

/**
 * Desi fiyat tablosundan kargo ücreti hesaplama
 * @param desi Ürün/sipariş desisi
 * @param priceRanges Kargo firmasının desi fiyat tablosu
 * @returns Kargo ücreti (TL) veya null (eşleşme yoksa)
 */
export function calculateShippingCost(
    desi: number,
    priceRanges: DesiPriceRange[]
): number | null {
    if (!priceRanges || priceRanges.length === 0 || desi <= 0) return null;

    // Desi aralığına göre sıralı
    const sorted = [...priceRanges].sort((a, b) => a.minDesi - b.minDesi);

    for (const range of sorted) {
        if (desi >= range.minDesi && desi <= range.maxDesi) {
            if (range.multiplierType === "MULTIPLY") {
                // Katsayı ile Çarp: fiyat × desi
                return Math.round(range.price * desi * 100) / 100;
            }
            // Sabit değer
            return range.price;
        }
    }

    // Eğer desi en büyük aralığın üstündeyse, son aralığı kullan
    const lastRange = sorted[sorted.length - 1];
    if (desi > lastRange.maxDesi) {
        if (lastRange.multiplierType === "MULTIPLY") {
            return Math.round(lastRange.price * desi * 100) / 100;
        }
        return lastRange.price;
    }

    return null;
}

/**
 * Sepetteki ürünlerin toplam desisini hesapla
 * @param items Sepet kalemleri (her birinin desi ve quantity bilgisi)
 * @returns Toplam desi
 */
export function calculateTotalDesi(
    items: Array<{ desi?: number | null; weight?: number | null; quantity: number }>
): number {
    return items.reduce((total, item) => {
        const effectiveDesi = getEffectiveDesi(item.weight, item.desi);
        return total + effectiveDesi * item.quantity;
    }, 0);
}

/**
 * Calculates the next shipping day based on a 14:00 cutoff and Mon-Fri business days.
 * @returns {string} The shipping day message (e.g., "Bugün", "Pazartesi", "Yarın (Salı)")
 */
export function getNextShippingDay(): string {
    const now = new Date();
    // For testing/development, you can offset 'now' if needed
    const day = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const hour = now.getHours();
    const cutoff = 14;

    // Days of the week in Turkish
    const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

    // 1. Weekends
    if (day === 0) return "Pazartesi"; // Sunday -> Monday
    if (day === 6) return "Pazartesi"; // Saturday -> Monday

    // 2. Friday after cutoff
    if (day === 5 && hour >= cutoff) return "Pazartesi";

    // 3. Weekdays before cutoff
    if (hour < cutoff) return "Bugün";

    // 4. Weekdays after cutoff (Mon-Thu)
    // Return "Yarın (DayName)"
    const nextDay = (day + 1) % 7;
    return `Yarın (${dayNames[nextDay]})`;
}

/**
 * Sepet ve ödeme ekranındaki kargo ücreti. İkisi de bu fonksiyonu kullanır; önceden kargo sadece ödeme ekranında
 * hesaplanıyordu, sepette ₺350 görüp ödemede ₺548 gören müşteri vazgeçiyordu.
 *  - Sepetteki tüm ürünler "Bu Üründe Ücretsiz Kargo" işaretliyse ücretsiz (bisikletler)
 *  - Sepet tutarı Ayarlar > Kargo'daki "Ücretsiz Kargo Limiti"ne ulaşırsa ücretsiz
 *  - Kalan ürünlerin desisi (getSummary().totalDesi, işaretli ürünler sayılmaz) firmanın desi tarifesiyle fiyatlanır
 *  - Desi fiyatlandırması kapalı firma: Alıcı Ödemeli
 */
export type CargoPricing = {
    id: string;
    name: string;
    isDesiActive: boolean;
    desiPrices: {
        minDesi: any;
        maxDesi: any;
        price: any;
        multiplierType: string;
    }[];
};

export type ShippingQuote = {
    cost: number;
    kind: "FREE" | "PAID" | "RECEIVER_PAYS";
};

export function quoteShipping(opts: {
    cargo?: CargoPricing | null;
    chargeableDesi: number;
    allItemsFreeShipping: boolean;
    cartTotal: number;
    freeShippingLimit: number;
}): ShippingQuote {
    const { cargo, chargeableDesi, allItemsFreeShipping, cartTotal, freeShippingLimit } = opts;

    if (allItemsFreeShipping) return { cost: 0, kind: "FREE" };
    if (freeShippingLimit > 0 && cartTotal >= freeShippingLimit) return { cost: 0, kind: "FREE" };
    if (chargeableDesi <= 0) return { cost: 0, kind: "FREE" };
    if (cargo && !cargo.isDesiActive) return { cost: 0, kind: "RECEIVER_PAYS" };
    if (!cargo || cargo.desiPrices.length === 0) return { cost: 0, kind: "PAID" };

    const range =
        cargo.desiPrices.find((r) => chargeableDesi >= Number(r.minDesi) && chargeableDesi <= Number(r.maxDesi)) ||
        cargo.desiPrices[cargo.desiPrices.length - 1]; // Tarifenin üst sınırı aşılırsa son aralık

    const rangePrice = Number(range.price);
    const cost = range.multiplierType === "MULTIPLY" ? rangePrice * Math.ceil(chargeableDesi) : rangePrice;
    return { cost, kind: "PAID" };
}
