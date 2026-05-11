import { PriceCalculation, CartItem, CartSummary } from "@/types";

export const SHIPPING_FREE_LIMIT = 20000; // DEPRECATED: Use settings.freeShippingLimit instead. Kept as fallback.

/**
 * Calculate discounted price for a product based on dealer discount rate
 */
/**
 * Calculate discounted price for a product based on dealer discount rate
 * NOTE: listPrice is treated as VAT-INCLUSIVE
 */
/**
 * Calculate discounted price for a product based on dealer discount rate AND sale price
 * NOTE: listPrice is treated as VAT-INCLUSIVE
 */
export function calculatePrice(
    listPrice: number,
    salePrice: number | undefined | null,
    discountRate: number,
    vatRate: number
): PriceCalculation {
    // 1. Calculate Dealer Discounted Price (VAT-inclusive)
    const dealerPrice = listPrice * (1 - discountRate / 100);

    // 2. Determine Best Price (Minimum of Dealer Price vs Sale Price)
    // If salePrice exists and is lower than dealerPrice, use salePrice.
    // Otherwise, use dealerPrice.
    let finalDiscountedPrice = dealerPrice;
    let appliedDiscountRate = discountRate;

    if (salePrice !== undefined && salePrice !== null && salePrice > 0) {
        if (salePrice < dealerPrice) {
            finalDiscountedPrice = salePrice;
            // Calculate effective discount rate for the sale price
            appliedDiscountRate = ((listPrice - salePrice) / listPrice) * 100;
        }
    }

    // 3. Calculate VAT amount from the inclusive price
    // Formula: Price = Base * (1 + Rate) => Base = Price / (1 + Rate)
    const basePrice = finalDiscountedPrice / (1 + vatRate / 100);
    const vatAmount = finalDiscountedPrice - basePrice;

    return {
        listPrice,
        discountRate: appliedDiscountRate,
        discountedPrice: roundPrice(finalDiscountedPrice),
        vatRate,
        vatAmount: roundPrice(vatAmount),
        finalPrice: roundPrice(finalDiscountedPrice),
    };
}

/**
 * Calculate cart summary with totals
 * NOTE: item.listPrice is VAT-INCLUSIVE
 */
export function calculateCartSummary(
    items: CartItem[],
    discountRate: number
): CartSummary {
    let subtotal = 0; // Total price (VAT inclusive)
    let discountAmount = 0;
    let vatAmount = 0;
    let totalDesi = 0;

    items.forEach((item) => {
        // Item total (List Price * Qty)
        const itemListTotal = item.listPrice * item.quantity;

        // Calculate single item price using Best Price Logic
        const priceCalc = calculatePrice(
            item.listPrice,
            item.salePrice,
            item.discountRate !== undefined ? item.discountRate : discountRate,
            item.vatRate
        );

        // Total calculated price for the quantity
        const itemFinalTotal = priceCalc.finalPrice * item.quantity;

        // Discount is the difference between List Total and Final Total
        const itemDiscount = itemListTotal - itemFinalTotal;

        // VAT for the total line
        const itemVat = priceCalc.vatAmount * item.quantity;

        subtotal += itemListTotal;
        discountAmount += itemDiscount;
        vatAmount += itemVat;

        // Add desi calculation
        totalDesi += (item.desi || 0) * item.quantity;
    });

    // Total to pay is simply subtotal minus discount
    const total = subtotal - discountAmount;

    // Subtotal in summary usually refers to the "Gross Total" before discounts
    // But sometimes it refers to "Net Subtotal" (without VAT).
    // Let's keep it as List Price Total for clarity in this context
    // Or closer to previous logic: Net Subtotal = Total - VAT

    return {
        items,
        subtotal: roundPrice(subtotal), // Gross Total (List Price)
        discountAmount: roundPrice(discountAmount),
        vatAmount: roundPrice(vatAmount),
        total: roundPrice(total),
        totalDesi: Math.ceil(totalDesi * 100) / 100, // Round up to 2 decimals
        itemCount: items.reduce((acc, item) => acc + item.quantity, 0),
    };
}

/**
 * Format price for display
 */
export function formatPrice(price: number, currency = "TRY"): string {
    return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(price);
}

/**
 * Round price to 2 decimal places
 */
export function roundPrice(price: number): number {
    return Math.round(price * 100) / 100;
}

/**
 * Generate unique order number
 */
export function generateOrderNumber(): string {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const random = Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, "0");
    return `SP${year}${month}${day}${random}`;
}

/**
 * Generate slug from text
 */
export function generateSlug(text: string): string {
    if (!text) return "";

    const turkishChars: Record<string, string> = {
        'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
        'Ç': 'c', 'Ğ': 'g', 'I': 'i', 'İ': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u',
    };

    return text
        .normalize('NFD') // Decompose characters (e.g., i + dot)
        .replace(/[\u0300-\u036f]/g, "") // Remove all combining marks (the hidden dots)
        .replace(/[çğıöşüÇĞIİÖŞÜ]/g, (char) => turkishChars[char] || char)
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

/**
 * Generate random SKU code
 * Format: ABC-12345
 */
export function generateSKU(): string {
    const prefix = "SRN";
    const random = Math.floor(Math.random() * 10000000)
        .toString()
        .padStart(7, "0");
    return `${prefix}-${random}`;
}

/**
 * Generate valid EAN-13 barcode
 */
export function generateBarcode(): string {
    // Prefix 460 (Russia)
    let code = "460" + Math.floor(Math.random() * 1000000000)
        .toString()
        .padStart(9, "0");

    // Calculate checksum
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
    }

    const checksum = (10 - (sum % 10)) % 10;
    return code + checksum;
}

/**
 * Validate minimum quantity
 */
export function validateMinQuantity(
    quantity: number,
    minQuantity: number
): { valid: boolean; message?: string } {
    if (quantity < minQuantity) {
        return {
            valid: false,
            message: `Bu ürün için minimum sipariş adedi ${minQuantity}'dir.`,
        };
    }
    return { valid: true };
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return new Intl.DateTimeFormat("tr-TR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(d);
}

/**
 * Get order status label in Turkish
 */
export function getOrderStatusLabel(status: string, paymentMethod?: string) {
    switch (status) {
        case "PENDING":
            if (paymentMethod === "BANK_TRANSFER") return "Havale Bekleniyor";
            if (paymentMethod === "CREDIT_CARD") return "Ödeme Bekleniyor (Kart)";
            return "Sipariş Alındı";
        case "WAITING_FOR_PAYMENT":
            return "Ödeme Bekleniyor";
        case "CONFIRMED":
            return "Onaylandı";
        case "PROCESSING":
            return "Hazırlanıyor";
        case "SHIPPED":
            return "Kargolandı";
        case "DELIVERED":
            return "Tamamlandı";
        case "CANCELLED":
            return "İptal Edildi";
        default:
            return status;
    }
}

/**
 * Get order status color for badges
 */
export function getOrderStatusColor(status: string): string {
    const statusColors: Record<string, string> = {
        PENDING: "bg-slate-500 text-white font-semibold",
        WAITING_FOR_PAYMENT: "bg-amber-500 text-white font-semibold",
        CONFIRMED: "bg-sky-500 text-white font-semibold",
        PROCESSING: "bg-fuchsia-600 text-white font-semibold",
        SHIPPED: "bg-indigo-600 text-white font-semibold",
        DELIVERED: "bg-emerald-600 text-white font-semibold",
        CANCELLED: "bg-rose-600 text-white font-semibold",
    };
    return statusColors[status] || "bg-slate-500 text-white";
}

/**
 * Get user status label in Turkish
 */
export function getUserStatusLabel(status: string): string {
    const statusLabels: Record<string, string> = {
        PENDING: "Onay Bekliyor",
        APPROVED: "Onaylandı",
        REJECTED: "Reddedildi",
        SUSPENDED: "Askıya Alındı",
    };
    return statusLabels[status] || status;
}

/**
 * Get user status color for badges
 */
export function getUserStatusColor(status: string): string {
    const statusColors: Record<string, string> = {
        PENDING: "bg-amber-500 text-white font-semibold",
        APPROVED: "bg-emerald-600 text-white font-semibold",
        REJECTED: "bg-rose-600 text-white font-semibold",
        SUSPENDED: "bg-slate-500 text-white font-semibold",
    };
    return statusColors[status] || "bg-slate-500 text-white";
}
