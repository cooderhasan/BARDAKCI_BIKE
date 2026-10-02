import {
    Body,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Preview,
    Section,
    Text,
    Tailwind,
    Row,
    Column,
    Button,
    Img,
    Link,
} from "@react-email/components";
import * as React from "react";

export interface ReviewRequestItem {
    productName: string;
    slug: string;
    imageUrl?: string;
    price?: number;
}

export interface ReviewRequestEmailProps {
    orderNumber: string;
    customerName: string;
    items: ReviewRequestItem[];
    store?: "BIKE" | "MOTOR";
    siteUrl?: string;
    whatsappNumber?: string;
}

export const ReviewRequestEmail = ({
    orderNumber,
    customerName = "Değerli Müşterimiz",
    items = [],
    store = "BIKE",
    siteUrl = "https://www.bardakcibike.com.tr",
    whatsappNumber = "0554 014 41 42",
}: ReviewRequestEmailProps) => {
    const isBike = store === "BIKE";
    const brandName = isBike ? "Bardakcı Bisiklet" : "Motovitrin";
    const brandColor = isBike ? "#17457C" : "#D32F2F";
    const accentColor = isBike ? "#F27A1A" : "#E53935";
    const rawPhone = whatsappNumber.replace(/\D/g, "");
    const waPhone = rawPhone.startsWith("90") ? rawPhone : (rawPhone.startsWith("0") ? `9${rawPhone}` : `90${rawPhone}`);

    const previewText = `${customerName}, siparişinizden memnun kaldınız mı? 🌟`;

    return (
        <Html>
            <Tailwind>
                <Head />
                <Preview>{previewText}</Preview>
                <Body className="bg-[#f1f5f9] my-auto mx-auto font-sans p-0 m-0">
                    <Container className="bg-white border border-solid border-[#e2e8f0] rounded-2xl shadow-md my-[28px] mx-auto p-0 max-w-[580px] w-full overflow-hidden">
                        
                        {/* Top Gradient Accent Bar */}
                        <div 
                            style={{
                                height: "6px",
                                background: `linear-gradient(90deg, ${brandColor} 0%, ${accentColor} 100%)`,
                                width: "100%",
                            }} 
                        />

                        <div style={{ padding: "28px 24px 24px 24px" }}>
                            {/* Brand Header */}
                            <Section className="text-center pb-5 mb-5 border-b border-gray-100">
                                <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                                    <div 
                                        style={{
                                            width: "36px",
                                            height: "36px",
                                            backgroundColor: brandColor,
                                            borderRadius: "10px",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            color: "#ffffff",
                                            fontWeight: "900",
                                            fontSize: "20px",
                                            lineHeight: "36px",
                                            textAlign: "center",
                                        }}
                                    >
                                        B
                                    </div>
                                    <div style={{ textAlign: "left", display: "inline-block" }}>
                                        <Text className="text-[20px] font-black tracking-wider m-0 uppercase leading-none" style={{ color: brandColor }}>
                                            {brandName}
                                            <span style={{ color: accentColor }}>.</span>
                                        </Text>
                                        <Text className="text-[10px] text-gray-400 m-0 uppercase tracking-widest font-semibold mt-0.5">
                                            {isBike ? "Bisiklet & Ekipman Dünyası" : "Motosiklet Yedek Parça & Aksesuar"}
                                        </Text>
                                    </div>
                                </div>
                            </Section>

                            {/* Hero Card */}
                            <Section 
                                style={{
                                    background: "linear-gradient(135deg, #f0f7ff 0%, #fff7ed 100%)",
                                    border: "1px solid #e0e7ff",
                                    borderRadius: "16px",
                                    padding: "24px 20px",
                                    textAlign: "center",
                                    marginBottom: "24px",
                                }}
                            >
                                <div 
                                    style={{
                                        width: "48px",
                                        height: "48px",
                                        backgroundColor: "#ffffff",
                                        borderRadius: "50%",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "24px",
                                        boxShadow: "0 4px 12px rgba(23, 69, 124, 0.08)",
                                        marginBottom: "12px",
                                        border: "1px solid #e2e8f0",
                                    }}
                                >
                                    {isBike ? "🚴‍♂️" : "🏍️"}
                                </div>

                                <Heading className="text-[22px] font-extrabold text-gray-900 m-0 leading-tight">
                                    {isBike ? "Siparişinizi Beğendiniz mi?" : "Siparişinizden Memnun Kaldınız mı?"}
                                </Heading>
                                <Text className="text-gray-600 text-[14px] mt-1.5 mb-3 font-medium">
                                    Alışveriş ve ürün deneyiminizi çok merak ediyoruz
                                </Text>

                                {/* Order Number Pill Badge */}
                                <div 
                                    style={{
                                        display: "inline-block",
                                        backgroundColor: "#ffffff",
                                        border: "1px solid #cbd5e1",
                                        borderRadius: "20px",
                                        padding: "4px 14px",
                                        fontSize: "12px",
                                        fontWeight: "700",
                                        color: brandColor,
                                        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                                    }}
                                >
                                    📦 Sipariş No: #{orderNumber}
                                </div>
                            </Section>

                            {/* Customer Message Callout Card */}
                            <Section 
                                style={{
                                    backgroundColor: "#f8fafc",
                                    borderLeft: `4px solid ${brandColor}`,
                                    borderRadius: "10px",
                                    padding: "16px 18px",
                                    marginBottom: "26px",
                                }}
                            >
                                <Text className="text-gray-900 text-[15px] leading-[24px] font-bold m-0 mb-1.5">
                                    Merhaba {customerName},
                                </Text>
                                <Text className="text-gray-600 text-[13.5px] leading-[22px] m-0 mb-2">
                                    <strong>#{orderNumber}</strong> numaralı siparişinizi teslim aldığınızı görüyoruz. 
                                    {isBike 
                                        ? " Satın aldığınız bisiklet ve bisiklet ekipmanlarınızla keyifli, konforlu ve güvenli sürüşler dileriz!"
                                        : " Satın aldığınız ürünlerle iyi günlerde güvenli yolculuklar dileriz!"}
                                </Text>
                                <Text className="text-gray-600 text-[13.5px] leading-[22px] m-0">
                                    Sizce ürünlerimiz ve hizmetimiz nasıldı? <strong>1 dakikanızı ayırarak</strong> ürünlerinizi değerlendirmeniz, hem bize rehber olacak hem de diğer sporseverlerin en doğru seçimi yapmasına yardımcı olacaktır.
                                </Text>
                            </Section>

                            {/* Product Review Cards Section */}
                            <Section className="my-6">
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                                    <Text className="text-gray-900 text-[13px] font-extrabold uppercase tracking-wider m-0 flex items-center gap-1.5">
                                        <span>🛍️</span> Teslim Edilen Ürünleriniz:
                                    </Text>
                                </div>

                                {items && items.length > 0 ? (
                                    items.map((item, index) => {
                                        const reviewUrl = `${siteUrl}/products/${item.slug || ""}?tab=reviews&rating=5#reviews`;
                                        const validImage = typeof item.imageUrl === "string" && item.imageUrl.trim().length > 0
                                            ? (item.imageUrl.startsWith("http") ? item.imageUrl : `${siteUrl}${item.imageUrl.startsWith("/") ? "" : "/"}${item.imageUrl}`)
                                            : null;

                                        return (
                                            <div
                                                key={index}
                                                style={{
                                                    backgroundColor: "#ffffff",
                                                    border: "1px solid #e2e8f0",
                                                    borderRadius: "16px",
                                                    padding: "18px",
                                                    marginBottom: "16px",
                                                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)",
                                                }}
                                            >
                                                <Row>
                                                    {/* Product Thumbnail */}
                                                    <Column style={{ width: "80px", verticalAlign: "top" }}>
                                                        <div 
                                                            style={{
                                                                width: "74px",
                                                                height: "74px",
                                                                backgroundColor: "#f8fafc",
                                                                borderRadius: "12px",
                                                                border: "1px solid #e2e8f0",
                                                                overflow: "hidden",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                            }}
                                                        >
                                                            {validImage ? (
                                                                <Img
                                                                    src={validImage}
                                                                    width="74"
                                                                    height="74"
                                                                    alt={item.productName || "Ürün"}
                                                                    style={{
                                                                        objectFit: "cover",
                                                                        display: "block",
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div
                                                                    style={{
                                                                        fontSize: "26px",
                                                                    }}
                                                                >
                                                                    🚲
                                                                </div>
                                                            )}
                                                        </div>
                                                    </Column>

                                                    {/* Product Details & Actions */}
                                                    <Column style={{ paddingLeft: "16px", verticalAlign: "top" }}>
                                                        <Text className="m-0 text-[14.5px] font-bold text-gray-900 leading-snug">
                                                            {item.productName || "Ürün"}
                                                        </Text>

                                                        {item.price ? (
                                                            <div style={{ marginTop: "4px" }}>
                                                                <span 
                                                                    style={{
                                                                        display: "inline-block",
                                                                        backgroundColor: "#ecfdf5",
                                                                        color: "#059669",
                                                                        fontSize: "12px",
                                                                        fontWeight: "800",
                                                                        padding: "2px 8px",
                                                                        borderRadius: "6px",
                                                                        border: "1px solid #a7f3d0",
                                                                    }}
                                                                >
                                                                    {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(item.price)}
                                                                </span>
                                                            </div>
                                                        ) : null}

                                                        {/* Interactive 5-Star Rating Buttons */}
                                                        <div style={{ marginTop: "12px" }}>
                                                            <Text className="m-0 text-[12px] text-gray-600 font-bold mb-1">
                                                                Hemen Puan Verin:
                                                            </Text>
                                                            <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                                                {[1, 2, 3, 4, 5].map((star) => (
                                                                    <Link
                                                                        key={star}
                                                                        href={`${siteUrl}/products/${item.slug || ""}?tab=reviews&rating=${star}#reviews`}
                                                                        style={{
                                                                            display: "inline-block",
                                                                            fontSize: "24px",
                                                                            textDecoration: "none",
                                                                            lineHeight: "1",
                                                                            padding: "4px 3px",
                                                                            cursor: "pointer",
                                                                        }}
                                                                        title={`${star} Yıldız Ver`}
                                                                    >
                                                                        ⭐
                                                                    </Link>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Review Button */}
                                                        <div style={{ marginTop: "12px" }}>
                                                            <Button
                                                                className="rounded-xl text-white text-[13px] font-bold no-underline text-center px-5 py-2.5 inline-block shadow-sm"
                                                                style={{ 
                                                                    backgroundColor: brandColor,
                                                                    borderBottom: `2px solid ${accentColor}`,
                                                                }}
                                                                href={reviewUrl}
                                                            >
                                                                ✍️ Ürünü Değerlendir (Yorum Yaz)
                                                            </Button>
                                                        </div>
                                                    </Column>
                                                </Row>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <Text className="text-gray-500 text-sm">Ürün bilgisi bulunamadı.</Text>
                                )}
                            </Section>

                            {/* WhatsApp Customer Support Card */}
                            <Section 
                                style={{
                                    backgroundColor: "#f0fdf4",
                                    border: "1px solid #bbf7d0",
                                    borderRadius: "16px",
                                    padding: "18px 20px",
                                    marginTop: "28px",
                                    marginBottom: "16px",
                                }}
                            >
                                <Row>
                                    <Column style={{ width: "36px", verticalAlign: "middle" }}>
                                        <div 
                                            style={{
                                                width: "32px",
                                                height: "32px",
                                                backgroundColor: "#22c55e",
                                                borderRadius: "50%",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                color: "#ffffff",
                                                fontSize: "18px",
                                            }}
                                        >
                                            💬
                                        </div>
                                    </Column>
                                    <Column style={{ paddingLeft: "10px", verticalAlign: "middle" }}>
                                        <Text className="text-emerald-950 text-[14px] font-bold m-0 leading-tight">
                                            Bir Sorun veya İhtiyacınız mı Var?
                                        </Text>
                                        <Text className="text-emerald-800 text-[12.5px] leading-[18px] m-0 mt-0.5">
                                            Montaj desteği veya herhangi bir aksilikte bize anında yazabilirsiniz.
                                        </Text>
                                    </Column>
                                </Row>

                                <div style={{ marginTop: "12px", textAlign: "left" }}>
                                    <Link
                                        href={`https://wa.me/${waPhone}`}
                                        style={{
                                            display: "inline-block",
                                            backgroundColor: "#22c55e",
                                            color: "#ffffff",
                                            textDecoration: "none",
                                            fontSize: "12.5px",
                                            fontWeight: "700",
                                            padding: "8px 16px",
                                            borderRadius: "10px",
                                            boxShadow: "0 2px 4px rgba(34, 197, 94, 0.2)",
                                        }}
                                    >
                                        WhatsApp Destek Hattı: {whatsappNumber} ↗
                                    </Link>
                                </div>
                            </Section>

                            <Hr className="border border-solid border-[#e2e8f0] my-[24px] mx-0 w-full" />

                            {/* Footer */}
                            <Section className="text-center pt-2">
                                <Text className="text-gray-500 text-[12px] font-semibold leading-[20px] m-0">
                                    © {new Date().getFullYear()} {brandName}. Tüm hakları saklıdır.
                                </Text>
                                <Text className="text-gray-400 text-[11px] leading-[18px] mt-1 m-0">
                                    Bu e-posta, {brandName} web sitesi (<Link href={siteUrl} style={{ color: brandColor, textDecoration: "none" }}>{siteUrl.replace(/^https?:\/\//, "")}</Link>) üzerinden tamamlanan siparişiniz sonrasında otomatik olarak gönderilmiştir.
                                </Text>
                            </Section>
                        </div>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default ReviewRequestEmail;
