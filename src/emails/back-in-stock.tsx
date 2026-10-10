import {
    Body,
    Container,
    Head,
    Heading,
    Html,
    Preview,
    Section,
    Text,
    Tailwind,
    Button,
    Img,
} from "@react-email/components";
import * as React from "react";

export interface BackInStockEmailProps {
    productName: string;
    productUrl: string;
    imageUrl?: string | null;
    price?: number | null;
    variantLabel?: string | null;
    store?: "BIKE" | "MOTOR";
}

export const BackInStockEmail = ({
    productName,
    productUrl,
    imageUrl,
    price,
    variantLabel,
    store = "BIKE",
}: BackInStockEmailProps) => {
    const isBike = store === "BIKE";
    const brandColor = isBike ? "#17457C" : "#D32F2F";
    const accentColor = isBike ? "#F27A1A" : "#E53935";

    return (
        <Html>
            <Tailwind>
                <Head />
                <Preview>{`Beklediğiniz ürün stoklarımızda: ${productName}`}</Preview>
                <Body className="bg-[#f1f5f9] my-auto mx-auto font-sans p-0 m-0">
                    <Container className="bg-white border border-solid border-[#e2e8f0] rounded-2xl my-[28px] mx-auto p-0 max-w-[580px] w-full overflow-hidden">
                        <div style={{ height: "6px", background: `linear-gradient(90deg, ${brandColor} 0%, ${accentColor} 100%)`, width: "100%" }} />

                        <div style={{ padding: "28px 24px 24px 24px" }}>
                            <Section style={{ textAlign: "center", paddingBottom: "18px", marginBottom: "20px", borderBottom: "1px solid #f1f5f9" }}>
                                <Text style={{ margin: "0", fontSize: "24px", fontWeight: "900", letterSpacing: "1.5px", textTransform: "uppercase", lineHeight: "1.2" }}>
                                    {isBike ? (
                                        <>
                                            <span style={{ color: brandColor }}>BARDAKCI</span>{" "}
                                            <span style={{ color: accentColor }}>BİSİKLET</span>
                                        </>
                                    ) : (
                                        <span style={{ color: brandColor }}>MOTOVİTRİN</span>
                                    )}
                                </Text>
                            </Section>

                            <Section style={{ textAlign: "center", marginBottom: "20px" }}>
                                <Heading className="text-[22px] font-extrabold text-gray-900 m-0 leading-tight">
                                    Beklediğiniz Ürün Stoklarımızda! 🎉
                                </Heading>
                                <Text className="text-gray-600 text-[14px] mt-2 mb-0">
                                    Haber vermemizi istediğiniz ürün tekrar satışta. Stoklar sınırlı olabilir.
                                </Text>
                            </Section>

                            <Section style={{ border: "1px solid #e2e8f0", borderRadius: "16px", padding: "18px", textAlign: "center", marginBottom: "22px" }}>
                                {imageUrl ? (
                                    <Img src={imageUrl} alt={productName} width="180" style={{ margin: "0 auto 12px auto", maxWidth: "180px", height: "auto" }} />
                                ) : null}
                                <Text className="text-gray-900 text-[15px] font-bold m-0">{productName}</Text>
                                {variantLabel ? <Text className="text-gray-500 text-[13px] m-0 mt-1">{variantLabel}</Text> : null}
                                {price ? (
                                    <Text style={{ color: brandColor, fontSize: "18px", fontWeight: 800, margin: "8px 0 0 0" }}>
                                        {price.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                                    </Text>
                                ) : null}
                            </Section>

                            <Section style={{ textAlign: "center", marginBottom: "18px" }}>
                                <Button
                                    href={productUrl}
                                    style={{ backgroundColor: brandColor, color: "#ffffff", padding: "14px 28px", borderRadius: "10px", fontWeight: 700, fontSize: "15px", textDecoration: "none" }}
                                >
                                    Ürünü İncele
                                </Button>
                            </Section>

                            <Text className="text-gray-400 text-[11px] leading-[17px] text-center m-0">
                                Bu e-postayı, ürün sayfasında "Gelince Haber Ver" talebi bıraktığınız için aldınız. Talebiniz bu bildirimle kapanmıştır; tekrar e-posta gönderilmeyecektir.
                            </Text>
                        </div>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default BackInStockEmail;
