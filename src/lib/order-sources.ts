/** Sipariş kaynağı (Order.source) için ekranda gösterilen adlar */
export const ORDER_SOURCE_LABELS: Record<string, string> = {
    WEB: "Site",
    TRENDYOL: "Trendyol",
    N11: "N11",
    HEPSIBURADA: "Hepsiburada",
    IDEFIX: "Idefix",
    PAZARAMA: "Pazarama",
    PTTAVM: "ePttAVM",
    CICEKSEPETI: "Çiçeksepeti",
};

/** Ciroya katılmayan sipariş durumları: iptal ve ödemesi tamamlanmamış */
export const NON_REVENUE_STATUSES = ["CANCELLED", "WAITING_FOR_PAYMENT"] as const;
