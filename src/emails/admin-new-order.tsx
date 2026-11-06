import { Body, Button, Column, Container, Head, Html, Preview, Row, Section, Text } from "@react-email/components";
import * as React from "react";
import {
    FONT,
    INK,
    LINE,
    MUTED,
    OrderEmailItem,
    OrderEmailPaymentMethod,
    OrderEmailStore,
    OrderItemRows,
    OrderTotals,
    SOFT,
    SectionTitle,
    formatTry,
    orderBrand,
} from "./order-email-shared";

interface AdminNewOrderEmailProps {
    orderNumber: string;
    orderId: string;
    customerName: string;
    companyName: string;
    totalAmount: number;
    items: OrderEmailItem[];
    store?: OrderEmailStore;
    paymentMethod?: OrderEmailPaymentMethod;
    shippingAddress?: {
        address: string;
        city: string;
        district?: string;
        phone?: string;
    };
    customerEmail?: string;
    isGuest?: boolean;
    cargoCompany?: string;
    shippingCost?: number;
}

const PAYMENT_LABEL: Record<OrderEmailPaymentMethod, { text: string; color: string }> = {
    CREDIT_CARD: { text: "Kredi Kartı · Ödendi", color: "#15803d" },
    BANK_TRANSFER: { text: "Havale / EFT · Ödeme bekleniyor", color: "#b45309" },
    CURRENT_ACCOUNT: { text: "Cari Hesap", color: INK },
};

const InfoRow = ({ label, value, color }: { label: string; value?: string; color?: string }) =>
    value ? (
        <Row>
            <Column style={{ width: "110px", padding: "3px 0", verticalAlign: "top" }}>
                <Text style={{ margin: 0, fontSize: "13px", lineHeight: "20px", color: MUTED, fontFamily: FONT }}>{label}</Text>
            </Column>
            <Column style={{ padding: "3px 0", verticalAlign: "top" }}>
                <Text style={{ margin: 0, fontSize: "14px", lineHeight: "20px", fontWeight: 500, color: color || INK, fontFamily: FONT }}>{value}</Text>
            </Column>
        </Row>
    ) : null;

export const AdminNewOrderEmail = ({
    orderNumber,
    orderId,
    customerName,
    companyName,
    totalAmount,
    items,
    store = "BIKE",
    paymentMethod,
    shippingAddress,
    customerEmail,
    isGuest,
    cargoCompany,
    shippingCost,
}: AdminNewOrderEmailProps) => {
    const brand = orderBrand(store);
    const payment = paymentMethod ? PAYMENT_LABEL[paymentMethod] : undefined;
    const customer = companyName && companyName !== customerName ? `${companyName} (${customerName})` : customerName;
    const location = [shippingAddress?.district, shippingAddress?.city].filter(Boolean).join(" / ");
    const customerType = isGuest === undefined ? undefined : isGuest ? "Misafir" : "Üye";

    return (
        <Html lang="tr">
            <Head />
            <Preview>{`${brand.name} - #${orderNumber} - ${formatTry(totalAmount)}`}</Preview>
            <Body style={{ margin: 0, padding: "24px 12px", backgroundColor: "#f3f4f6", fontFamily: FONT }}>
                <Container style={{ maxWidth: "560px", backgroundColor: "#ffffff", borderRadius: "10px", border: `1px solid ${LINE}`, overflow: "hidden" }}>
                    <Section style={{ backgroundColor: brand.color, padding: "16px 28px" }}>
                        <Text style={{ margin: 0, fontSize: "14px", lineHeight: "20px", fontWeight: 700, color: "#ffffff", fontFamily: FONT }}>{brand.name} · Yeni Sipariş</Text>
                    </Section>

                    <Section style={{ padding: "22px 28px 0" }}>
                        <Row>
                            <Column>
                                <Text style={{ margin: 0, fontSize: "12px", lineHeight: "18px", color: MUTED, fontFamily: FONT }}>Sipariş No</Text>
                                <Text style={{ margin: 0, fontSize: "18px", lineHeight: "26px", fontWeight: 700, color: INK, fontFamily: FONT }}>#{orderNumber}</Text>
                            </Column>
                            <Column align="right">
                                <Text style={{ margin: 0, fontSize: "12px", lineHeight: "18px", color: MUTED, fontFamily: FONT }}>Toplam</Text>
                                <Text style={{ margin: 0, fontSize: "22px", lineHeight: "26px", fontWeight: 700, color: brand.color, fontFamily: FONT }}>{formatTry(totalAmount)}</Text>
                            </Column>
                        </Row>
                    </Section>

                    <Section style={{ padding: "18px 28px 0" }}>
                        <Section style={{ backgroundColor: SOFT, borderRadius: "8px", padding: "12px 16px" }}>
                            <InfoRow label="Müşteri" value={customerType ? `${customer} · ${customerType}` : customer} />
                            <InfoRow label="Telefon" value={shippingAddress?.phone} />
                            <InfoRow label="E-posta" value={customerEmail} />
                            <InfoRow label="Adres" value={shippingAddress ? [shippingAddress.address, location].filter(Boolean).join(", ") : undefined} />
                            <InfoRow label="Ödeme" value={payment?.text} color={payment?.color} />
                            <InfoRow label="Kargo" value={cargoCompany} />
                        </Section>
                    </Section>

                    <Section style={{ padding: "20px 28px 0" }}>
                        <SectionTitle>Ürünler</SectionTitle>
                        {items && items.length > 0 ? (
                            <OrderItemRows items={items} />
                        ) : (
                            <Text style={{ margin: 0, fontSize: "13px", color: MUTED, fontFamily: FONT }}>Ürün bilgisi bulunamadı.</Text>
                        )}
                        <OrderTotals items={items || []} totalAmount={totalAmount} shippingCost={shippingCost} accent={brand.color} />
                    </Section>

                    <Section style={{ padding: "22px 28px 26px", textAlign: "center" }}>
                        <Button
                            href={`https://www.bardakcibike.com.tr/admin/orders/${orderId}`}
                            style={{ backgroundColor: brand.color, color: "#ffffff", borderRadius: "8px", padding: "12px 26px", fontSize: "14px", fontWeight: 700, textDecoration: "none", fontFamily: FONT }}
                        >
                            Siparişi Görüntüle
                        </Button>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
};

export default AdminNewOrderEmail;
