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
}

export const ReviewRequestEmail = ({
    orderNumber,
    customerName,
    items,
    store = "BIKE",
    siteUrl = "https://www.bardakcibike.com.tr",
}: ReviewRequestEmailProps) => {
    const isBike = store === "BIKE";
    const brandName = isBike ? "Bardakçı Bisiklet" : "Motovitrin";
    const brandColor = isBike ? "#17457C" : "#D32F2F";
    const accentColor = isBike ? "#F27A1A" : "#E53935";

    const previewText = `${customerName}, siparişinizden memnun kaldınız mı? 🌟`;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <Body className="bg-[#f4f6f8] my-auto mx-auto font-sans p-0 m-0">
                    <Container className="bg-white border border-solid border-[#e5e7eb] rounded-2xl shadow-sm my-[20px] sm:my-[32px] mx-auto p-[18px] sm:p-[28px] max-w-[560px] w-full">
                        
                        {/* Header / Brand Logo */}
                        <Section className="text-center pb-4 mb-4 border-b border-gray-100">
                            <Text className="text-[20px] font-black tracking-wider m-0 uppercase" style={{ color: brandColor }}>
                                {brandName}
                                <span style={{ color: accentColor }}>.</span>
                            </Text>
                            <Text className="text-[12px] text-gray-400 mt-1 uppercase tracking-widest">
                                {isBike ? "Bisiklet & Ekipman Dünyası" : "Motosiklet Yedek Parça & Aksesuar"}
                            </Text>
                        </Section>

                        {/* Hero / Greeting */}
                        <Section className="text-center my-6">
                            <Heading className="text-[22px] font-bold text-gray-900 m-0 leading-tight">
                                {isBike ? "Siparişinizi Beğendiniz mi? 🚴‍♂️" : "Siparişinizden Memnun Kaldınız mı? 🏍️"}
                            </Heading>
                            <Text className="text-gray-500 text-[14px] mt-2 mb-0">
                                Alışveriş ve ürün deneyiminizi çok merak ediyoruz
                            </Text>
                        </Section>

                        {/* Intro Text */}
                        <Text className="text-gray-700 text-[15px] leading-[24px]">
                            Merhaba <strong>{customerName}</strong>,
                        </Text>
                        <Text className="text-gray-600 text-[14px] leading-[24px]">
                            <strong>#{orderNumber}</strong> numaralı siparişinizi teslim aldığınızı görüyoruz. 
                            {isBike 
                                ? " Satın aldığınız bisiklet ve bisiklet ekipmanlarınızla keyifli, konforlu ve güvenli sürüşler dileriz!"
                                : " Satın aldığınız ürünlerle iyi günlerde güvenli yolculuklar dileriz!"}
                        </Text>
                        <Text className="text-gray-600 text-[14px] leading-[24px]">
                            Sizce ürünlerimiz ve hizmetimiz nasıldı? <strong>Sadece 1 dakikanızı ayırarak</strong> ürünlerinizi değerlendirmeniz, hem bize ışık tutacak hem de diğer sporseverlerin en doğru seçimi yapmasına yardımcı olacaktır.
                        </Text>

                        {/* Product Review Cards */}
                        <Section className="my-6">
                            <Text className="text-gray-900 text-[14px] font-bold uppercase tracking-wider mb-3">
                                Teslim Edilen Ürünleriniz:
                            </Text>

                            {items && items.length > 0 ? (
                                items.map((item, index) => {
                                    const reviewUrl = `${siteUrl}/products/${item.slug}?tab=reviews&rating=5#reviews`;

                                    return (
                                        <div
                                            key={index}
                                            className="bg-[#fafbfc] border border-solid border-[#e5e7eb] rounded-xl p-4 mb-4"
                                        >
                                            <Row>
                                                {/* Product Image */}
                                                <Column style={{ width: "72px", verticalAlign: "top" }}>
                                                    {item.imageUrl ? (
                                                        <Img
                                                            src={item.imageUrl.startsWith("http") ? item.imageUrl : `${siteUrl}${item.imageUrl.startsWith("/") ? "" : "/"}${item.imageUrl}`}
                                                            width="64"
                                                            height="64"
                                                            alt={item.productName}
                                                            style={{
                                                                borderRadius: "10px",
                                                                objectFit: "cover",
                                                                display: "block",
                                                                border: "1px solid #e5e7eb",
                                                            }}
                                                        />
                                                    ) : (
                                                        <div
                                                            style={{
                                                                width: "64px",
                                                                height: "64px",
                                                                backgroundColor: "#f3f4f6",
                                                                borderRadius: "10px",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                fontSize: "20px",
                                                            }}
                                                        >
                                                            🚲
                                                        </div>
                                                    )}
                                                </Column>

                                                {/* Product Details & Actions */}
                                                <Column style={{ paddingLeft: "14px", verticalAlign: "top" }}>
                                                    <Text className="m-0 text-[14px] font-bold text-gray-900 leading-snug">
                                                        {item.productName}
                                                    </Text>

                                                    {item.price ? (
                                                        <Text className="m-0 text-[12px] text-gray-500 mt-0.5">
                                                            {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(item.price)}
                                                        </Text>
                                                    ) : null}

                                                    {/* Star Rating Quick Links */}
                                                    <div className="mt-3">
                                                        <Text className="m-0 text-[12px] text-gray-600 font-medium mb-1.5">
                                                            Hemen puan verin:
                                                        </Text>
                                                        <div className="flex items-center gap-1">
                                                            {[1, 2, 3, 4, 5].map((star) => (
                                                                <Link
                                                                    key={star}
                                                                    href={`${siteUrl}/products/${item.slug}?tab=reviews&rating=${star}#reviews`}
                                                                    style={{
                                                                        display: "inline-block",
                                                                        fontSize: "22px",
                                                                        textDecoration: "none",
                                                                        lineHeight: "1",
                                                                        padding: "4px 3px",
                                                                    }}
                                                                    title={`${star} Yıldız Ver`}
                                                                >
                                                                    ⭐
                                                                </Link>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Review Button */}
                                                    <div className="mt-3">
                                                        <Button
                                                            className="rounded-lg text-white text-[13px] font-bold no-underline text-center px-4 py-2 inline-block shadow-sm"
                                                            style={{ backgroundColor: brandColor }}
                                                            href={reviewUrl}
                                                        >
                                                            Yorum Yap & Değerlendir ✍️
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

                        {/* Customer Support Reassurance Box */}
                        <Section className="bg-blue-50/70 border border-blue-100 rounded-xl p-4 my-6">
                            <Text className="text-blue-950 text-[14px] font-bold m-0 mb-1 flex items-center">
                                💬 Bir Sorun veya İhtiyacınız mı Var?
                            </Text>
                            <Text className="text-blue-900/80 text-[13px] leading-[20px] m-0">
                                Ürününüzde montaj desteğine ihtiyacınız varsa veya herhangi bir aksilik yaşadıysanız, yorum yapmadan önce lütfen bizimle iletişime geçin. Size yardımcı olmaktan memnuniyet duyarız.
                            </Text>
                            <div className="mt-3">
                                <Link
                                    href="https://wa.me/905443204242"
                                    className="text-[13px] font-bold text-[#17457C] underline"
                                >
                                    WhatsApp Destek Hattı: 0544 320 42 42 ↗
                                </Link>
                            </div>
                        </Section>

                        <Hr className="border border-solid border-[#e5e7eb] my-[24px] mx-0 w-full" />

                        {/* Footer */}
                        <Section className="text-center">
                            <Text className="text-gray-400 text-[12px] leading-[20px] m-0">
                                © {new Date().getFullYear()} {brandName}. Tüm hakları saklıdır.
                            </Text>
                            <Text className="text-gray-400 text-[11px] leading-[18px] mt-1 m-0">
                                Bu e-posta, {brandName} web sitesi ({siteUrl}) üzerinden tamamlanan siparişiniz sonrasında otomatik olarak gönderilmiştir.
                            </Text>
                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default ReviewRequestEmail;
