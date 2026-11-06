import { Body, Button, Column, Container, Head, Hr, Html, Preview, Row, Section, Text } from "@react-email/components";
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
    orderBrand,
} from "./order-email-shared";

interface OrderConfirmationEmailProps {
    orderNumber: string;
    customerName: string;
    items: OrderEmailItem[];
    totalAmount: number;
    paymentMethod: OrderEmailPaymentMethod;
    bankInfo?: {
        bankName: string;
        iban: string;
        accountHolder: string;
    };
    store?: OrderEmailStore;
    /** Sipariş takip sayfası; yoksa düğme çıkmaz */
    orderUrl?: string;
    shippingAddress?: {
        address: string;
        city: string;
        district?: string;
        phone?: string;
    };
    cargoCompany?: string;
    shippingCost?: number;
    contactPhone?: string;
    contactEmail?: string;
    hasContracts?: boolean;
    /** Kartla ödenen gerçek tutar (taksitte vade farkı dahil) */
    paidAmount?: number;
    installmentCount?: number;
}

const PAYMENT_TEXT: Record<OrderEmailPaymentMethod, { label: string; intro: string; next: string }> = {
    CREDIT_CARD: {
        label: "Kredi Kartı (ödeme alındı)",
        intro: "Ödemeniz alındı, siparişiniz hazırlanıyor.",
        next: "Siparişinizi hazırlayıp kargoya vereceğiz.",
    },
    BANK_TRANSFER: {
        label: "Havale / EFT (ödeme bekleniyor)",
        intro: "Siparişiniz oluşturuldu. Ödemeniz bize ulaştığında hazırlamaya başlayacağız.",
        next: "Ödemeniz ulaştığında siparişinizi hazırlayıp kargoya vereceğiz.",
    },
    CURRENT_ACCOUNT: {
        label: "Cari Hesap",
        intro: "Siparişiniz cari hesabınıza işlendi, hazırlanıyor.",
        next: "Siparişinizi hazırlayıp kargoya vereceğiz.",
    },
};

export const OrderConfirmationEmail = ({
    orderNumber,
    customerName,
    items,
    totalAmount,
    paymentMethod,
    bankInfo,
    store = "BIKE",
    orderUrl,
    shippingAddress,
    cargoCompany,
    shippingCost,
    contactPhone,
    contactEmail,
    hasContracts,
    paidAmount,
    installmentCount,
}: OrderConfirmationEmailProps) => {
    const brand = orderBrand(store);
    const payment = PAYMENT_TEXT[paymentMethod] || PAYMENT_TEXT.CREDIT_CARD;
    const paymentLabel = paymentMethod === "CREDIT_CARD" && Number(installmentCount) > 1
        ? `Kredi Kartı · ${installmentCount} Taksit (ödeme alındı)`
        : payment.label;
    const location = [shippingAddress?.district, shippingAddress?.city].filter(Boolean).join(" / ");
    const textStyle = { margin: 0, fontSize: "14px", lineHeight: "22px", color: INK, fontFamily: FONT };

    return (
        <Html lang="tr">
            <Head />
            <Preview>{`Siparişiniz alındı - #${orderNumber}`}</Preview>
            <Body style={{ margin: 0, padding: "24px 12px", backgroundColor: "#f3f4f6", fontFamily: FONT }}>
                <Container style={{ maxWidth: "560px", backgroundColor: "#ffffff", borderRadius: "10px", border: `1px solid ${LINE}`, overflow: "hidden" }}>
                    <Section style={{ backgroundColor: brand.color, padding: "18px 28px" }}>
                        <Text style={{ margin: 0, fontSize: "20px", lineHeight: "26px", fontWeight: 800, color: "#ffffff", fontFamily: FONT }}>{brand.name}</Text>
                    </Section>

                    <Section style={{ padding: "26px 28px 6px" }}>
                        <Text style={{ margin: "0 0 6px", fontSize: "22px", lineHeight: "28px", fontWeight: 700, color: INK, fontFamily: FONT }}>Siparişiniz alındı</Text>
                        <Text style={textStyle}>Merhaba {customerName},<br />{payment.intro}</Text>
                        <Text style={{ margin: "12px 0 0", fontSize: "13px", lineHeight: "20px", color: MUTED, fontFamily: FONT }}>
                            Sipariş numaranız: <strong style={{ color: INK }}>#{orderNumber}</strong>
                        </Text>
                    </Section>

                    {paymentMethod === "BANK_TRANSFER" && bankInfo && (
                        <Section style={{ padding: "16px 28px 0" }}>
                            <Section style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", padding: "14px 16px" }}>
                                <Text style={{ margin: "0 0 6px", fontSize: "14px", lineHeight: "20px", fontWeight: 700, color: INK, fontFamily: FONT }}>Havale / EFT bilgileri</Text>
                                <Text style={textStyle}>{bankInfo.bankName}</Text>
                                <Text style={textStyle}>{bankInfo.accountHolder}</Text>
                                <Text style={{ ...textStyle, fontWeight: 700, letterSpacing: "0.3px" }}>{bankInfo.iban}</Text>
                                <Text style={{ margin: "6px 0 0", fontSize: "12px", lineHeight: "18px", color: MUTED, fontFamily: FONT }}>
                                    Açıklama kısmına <strong style={{ color: INK }}>#{orderNumber}</strong> yazmayı unutmayın.
                                </Text>
                            </Section>
                        </Section>
                    )}

                    <Section style={{ padding: "22px 28px 0" }}>
                        <SectionTitle>Sipariş özeti</SectionTitle>
                        <OrderItemRows items={items} />
                        <OrderTotals items={items} totalAmount={totalAmount} shippingCost={shippingCost} accent={brand.color} paidAmount={paidAmount} installmentCount={installmentCount} />
                    </Section>

                    <Section style={{ padding: "22px 28px 0" }}>
                        <Row>
                            {shippingAddress && (
                                <Column style={{ width: "55%", verticalAlign: "top", paddingRight: "12px" }}>
                                    <SectionTitle>Teslimat adresi</SectionTitle>
                                    <Text style={textStyle}>{customerName}</Text>
                                    <Text style={textStyle}>{shippingAddress.address}</Text>
                                    {location && <Text style={textStyle}>{location}</Text>}
                                    {shippingAddress.phone && <Text style={textStyle}>{shippingAddress.phone}</Text>}
                                </Column>
                            )}
                            <Column style={{ verticalAlign: "top" }}>
                                <SectionTitle>Ödeme</SectionTitle>
                                <Text style={textStyle}>{paymentLabel}</Text>
                                {cargoCompany && (
                                    <>
                                        <div style={{ height: "14px" }} />
                                        <SectionTitle>Kargo</SectionTitle>
                                        <Text style={textStyle}>{cargoCompany}</Text>
                                    </>
                                )}
                            </Column>
                        </Row>
                    </Section>

                    <Section style={{ padding: "22px 28px 0" }}>
                        <Section style={{ backgroundColor: SOFT, borderRadius: "8px", padding: "14px 16px" }}>
                            <Text style={{ margin: "0 0 4px", fontSize: "14px", lineHeight: "20px", fontWeight: 700, color: INK, fontFamily: FONT }}>Sırada ne var?</Text>
                            <Text style={textStyle}>{payment.next} Kargoya verildiğinde takip bilgilerini e-posta ile göndereceğiz.</Text>
                        </Section>
                    </Section>

                    {orderUrl && (
                        <Section style={{ padding: "22px 28px 0", textAlign: "center" }}>
                            <Button
                                href={orderUrl}
                                style={{ backgroundColor: brand.color, color: "#ffffff", borderRadius: "8px", padding: "12px 26px", fontSize: "14px", fontWeight: 700, textDecoration: "none", fontFamily: FONT }}
                            >
                                Siparişimi Görüntüle
                            </Button>
                        </Section>
                    )}

                    <Section style={{ padding: "22px 28px 24px" }}>
                        <Hr style={{ borderColor: LINE, margin: "0 0 14px" }} />
                        {(contactPhone || contactEmail) && (
                            <Text style={{ margin: "0 0 6px", fontSize: "13px", lineHeight: "20px", color: MUTED, fontFamily: FONT }}>
                                Sorunuz mu var? {[contactPhone, contactEmail].filter(Boolean).join(" · ")}
                            </Text>
                        )}
                        {hasContracts && (
                            <Text style={{ margin: "0 0 6px", fontSize: "13px", lineHeight: "20px", color: MUTED, fontFamily: FONT }}>
                                Ön bilgilendirme formu, mesafeli satış sözleşmesi ve iptal-iade koşulları bu e-postanın ekindedir.
                            </Text>
                        )}
                        <Text style={{ margin: 0, fontSize: "12px", lineHeight: "18px", color: MUTED, fontFamily: FONT }}>Bu e-posta otomatik olarak gönderilmiştir.</Text>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
};

export default OrderConfirmationEmail;
