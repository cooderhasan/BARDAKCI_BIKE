import { Column, Row, Section, Text } from "@react-email/components";
import * as React from "react";

export interface OrderEmailItem {
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    variantInfo?: string;
}

export type OrderEmailStore = "BIKE" | "MOTOR";
export type OrderEmailPaymentMethod = "BANK_TRANSFER" | "CREDIT_CARD" | "CURRENT_ACCOUNT";

export const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
export const INK = "#111827";
export const MUTED = "#6b7280";
export const LINE = "#e5e7eb";
export const SOFT = "#f9fafb";

export const formatTry = (value: number) =>
    new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(value || 0);

export function orderBrand(store: OrderEmailStore = "BIKE") {
    return store === "MOTOR"
        ? { name: "Moto Vitrin", color: "#D32F2F", accent: "#E53935" }
        : { name: "Bardakcı Bisiklet", color: "#17457C", accent: "#F27A1A" };
}

export const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <Text style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: MUTED, fontFamily: FONT }}>
        {children}
    </Text>
);

export const OrderItemRows = ({ items }: { items: OrderEmailItem[] }) => (
    <Section>
        {items.map((item, index) => (
            <Row key={index} style={{ borderBottom: `1px solid ${LINE}` }}>
                <Column style={{ padding: "10px 12px 10px 0", verticalAlign: "top" }}>
                    <Text style={{ margin: 0, fontSize: "14px", lineHeight: "20px", fontWeight: 600, color: INK, fontFamily: FONT }}>{item.productName}</Text>
                    {item.variantInfo && (
                        <Text style={{ margin: "2px 0 0", fontSize: "12px", lineHeight: "18px", color: MUTED, fontFamily: FONT }}>{item.variantInfo}</Text>
                    )}
                    <Text style={{ margin: "2px 0 0", fontSize: "12px", lineHeight: "18px", color: MUTED, fontFamily: FONT }}>
                        {item.quantity} adet × {formatTry(item.unitPrice)}
                    </Text>
                </Column>
                <Column align="right" style={{ padding: "10px 0", verticalAlign: "top", whiteSpace: "nowrap" }}>
                    <Text style={{ margin: 0, fontSize: "14px", lineHeight: "20px", fontWeight: 600, color: INK, fontFamily: FONT }}>{formatTry(item.lineTotal)}</Text>
                </Column>
            </Row>
        ))}
    </Section>
);

const TotalRow = ({ label, value, strong, color }: { label: string; value: string; strong?: boolean; color?: string }) => (
    <Row>
        <Column style={{ padding: strong ? "10px 0 0" : "3px 0" }}>
            <Text style={{ margin: 0, fontSize: strong ? "15px" : "14px", lineHeight: "20px", fontWeight: strong ? 700 : 400, color: strong ? INK : MUTED, fontFamily: FONT }}>{label}</Text>
        </Column>
        <Column align="right" style={{ padding: strong ? "10px 0 0" : "3px 0", whiteSpace: "nowrap" }}>
            <Text style={{ margin: 0, fontSize: strong ? "18px" : "14px", lineHeight: "20px", fontWeight: strong ? 700 : 400, color: color || INK, fontFamily: FONT }}>{value}</Text>
        </Column>
    </Row>
);

/** Ürün toplamı + kargo - indirim = toplam; indirim ayrı alan olarak gelmediği için aradaki farktan bulunur */
export const OrderTotals = ({ items, totalAmount, shippingCost, accent }: { items: OrderEmailItem[]; totalAmount: number; shippingCost?: number; accent: string }) => {
    const subtotal = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
    const shipping = Number(shippingCost || 0);
    const discount = subtotal + shipping - totalAmount;

    return (
        <Section style={{ marginTop: "8px" }}>
            <TotalRow label="Ürünler" value={formatTry(subtotal)} />
            <TotalRow label="Kargo" value={shipping > 0 ? formatTry(shipping) : "Ücretsiz"} />
            {discount > 0.01 && <TotalRow label="İndirim" value={`-${formatTry(discount)}`} />}
            <TotalRow label="Toplam" value={formatTry(totalAmount)} strong color={accent} />
        </Section>
    );
};
