import type { UblInvoiceLine } from "./ubl-builder";

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const round4 = (value: number) => Math.round((value + Number.EPSILON) * 10000) / 10000;

/**
 * Sipariş kalemlerini fatura satırlarına çevirir.
 * KDV dahil satır tutarı esas alınır (inclTotal), böylece fatura toplamı sipariş tutarıyla kuruşu kuruşuna tutar.
 */
export function buildInvoiceLines(order: any): UblInvoiceLine[] {
    // Sipariş toplam ürün tutarı (KDV dahil, ürün indirimleri uygulanmış)
    const itemsTotalInclTax = order.items.reduce((sum: number, item: any) => {
        return sum + Number(item.lineTotal);
    }, 0);

    // Kargo ücreti (KDV dahil olarak DB'de saklanıyor)
    const shippingCostInclTax = Number(order.shippingCost || 0);

    // Havale veya sipariş geneli ek indirim hesapla:
    // Sipariş totali (order.total) = ürünler + kargo - ek indirim
    const orderTotal = Number(order.total);
    const expectedWithoutDiscount = itemsTotalInclTax + shippingCostInclTax;
    const extraDiscountAmountInclTax = Math.max(0, Math.round((expectedWithoutDiscount - orderTotal) * 100) / 100);

    // Ek indirim oranı (ürünler üzerinden orantılı dağıtılır)
    const extraDiscountRatio = (extraDiscountAmountInclTax > 0.01 && itemsTotalInclTax > 0)
        ? extraDiscountAmountInclTax / itemsTotalInclTax
        : 0;

    const lines: UblInvoiceLine[] = order.items.map((item: any) => {
        const quantity = item.quantity || 1;
        // Kalemin müşteriye satılan KDV Dahil net tutarı (kampanya/ürün indirimi düşülmüş hali, örn: 11.500 TL)
        const lineTotalInclTax = Number(item.lineTotal);

        // Sipariş geneli ek indirim varsa (örn: havale indirimi), kaleme düşen payı uygula
        const finalLineTotalInclTax = extraDiscountRatio > 0
            ? lineTotalInclTax * (1 - extraDiscountRatio)
            : lineTotalInclTax;

        const vatRate = item.vatRate || 20;

        // Gerçek KDV dahil birim fiyat (örn: 11.500 TL)
        const unitPriceInclTax = quantity > 0 ? (finalLineTotalInclTax / quantity) : finalLineTotalInclTax;

        // KDV hariç birim fiyat (örn: 9.583,3333 TL); 2 haneye yuvarlanırsa adetle çarpınca toplam kayıyordu
        const unitPriceExclTax = unitPriceInclTax / (1 + vatRate / 100);

        return {
            name: item.productName || item.product?.name || "Ürün",
            quantity,
            unitCode: "C62",
            unitPrice: round4(unitPriceExclTax),
            taxRate: vatRate,
            inclTotal: finalLineTotalInclTax,
        };
    });

    // Kargo ücreti ekle (KDV dahil → KDV hariç dönüşümü)
    if (shippingCostInclTax > 0) {
        const shippingVatRate = 20;
        const shippingCostExclTax = shippingCostInclTax / (1 + shippingVatRate / 100);
        lines.push({
            name: "Kargo Ücreti",
            quantity: 1,
            unitCode: "C62",
            unitPrice: round4(shippingCostExclTax),
            taxRate: shippingVatRate,
            inclTotal: shippingCostInclTax,
        });
    }

    // İndirim dağıtımındaki kuruş artığı son satıra yazılır; büyük fark (tutarsız sipariş) olduğu gibi kalır
    const linesTotal = lines.reduce((sum, line) => sum + round2(line.inclTotal || 0), 0);
    const remainder = round2(orderTotal - linesTotal);
    const lastLine = lines[lines.length - 1];
    if (lastLine && remainder !== 0 && Math.abs(remainder) <= 0.05) {
        lastLine.inclTotal = round2(lastLine.inclTotal || 0) + remainder;
    }

    return lines;
}
