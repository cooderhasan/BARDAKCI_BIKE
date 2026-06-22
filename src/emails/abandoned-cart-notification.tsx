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
} from "@react-email/components";
import * as React from "react";

interface AbandonedCartItem {
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    imageUrl?: string;
}

interface AbandonedCartNotificationEmailProps {
    customerName: string;
    items: AbandonedCartItem[];
    totalAmount: number;
    continueShoppingUrl: string;
}

export const AbandonedCartNotificationEmail = ({
    customerName,
    items,
    totalAmount,
    continueShoppingUrl,
}: AbandonedCartNotificationEmailProps) => {
    const previewText = `Sepetinizde ürünler unuttunuz, kaldığınız yerden devam edin!`;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <Body className="bg-gray-50 my-auto mx-auto font-sans">
                    <Container className="bg-white border border-solid border-[#eaeaea] rounded shadow-sm my-[40px] mx-auto p-[20px] w-[500px]">
                        <Heading className="text-black text-[22px] font-bold text-center p-0 my-[30px] mx-0">
                            Sepetinizde Ürünler Sizi Bekliyor!
                        </Heading>
                        <Text className="text-gray-800 text-[15px] leading-[24px]">
                            Merhaba <strong>{customerName}</strong>,
                        </Text>
                        <Text className="text-gray-600 text-[15px] leading-[24px]">
                            Mağazamızda harika ürünler seçtiniz ancak alışverişinizi tamamlamadığınızı fark ettik.
                            Sepetinizdeki ürünler stokları tükenmeden sizi bekliyor.
                        </Text>

                        <Section className="mt-[32px] mb-[32px] bg-gray-50 p-4 rounded-xl border border-gray-100">
                            {items && items.length > 0 ? (
                                items.map((item, index) => (
                                    <Row key={index} className="border-b border-gray-200 pb-4 mb-4">
                                        <Column style={{ width: "80px" }}>
                                            {item.imageUrl ? (
                                                <Img 
                                                    src={item.imageUrl}
                                                    width="64"
                                                    height="64"
                                                    alt={item.productName || "Ürün"}
                                                    style={{ borderRadius: "8px", objectFit: "cover", display: "block" }}
                                                />
                                            ) : (
                                                <div style={{ width: "64px", height: "64px", backgroundColor: "#f3f4f6", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "#9ca3af" }}>
                                                    Ürün
                                                </div>
                                            )}
                                        </Column>
                                        <Column style={{ paddingLeft: "12px", verticalAlign: "top" }}>
                                            <Text className="m-0 text-[14px] font-semibold text-gray-800">{item.productName}</Text>
                                            <Text className="m-0 text-[12px] text-gray-500 mt-1">Adet: {item.quantity}</Text>
                                        </Column>
                                        <Column align="right" style={{ verticalAlign: "top" }}>
                                            <Text className="m-0 text-[14px] font-semibold text-gray-800">
                                                {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(item.lineTotal || 0)}
                                            </Text>
                                        </Column>
                                    </Row>
                                ))
                            ) : (
                                <Text className="text-gray-500 text-center py-4">Ürün bilgileri yüklenemedi.</Text>
                            )}
                        </Section>

                        <Section>
                            <Row>
                                <Column>
                                    <Text className="text-[16px] font-bold m-0 text-gray-800">Sepet Toplamı:</Text>
                                </Column>
                                <Column align="right">
                                    <Text className="text-[20px] font-bold m-0 text-[#17457C]">
                                        {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(totalAmount)}
                                    </Text>
                                </Column>
                            </Row>
                        </Section>

                        <Section className="text-center mt-[32px] mb-[32px]">
                            <Button
                                className="bg-[#17457C] rounded-xl text-white text-[15px] font-semibold no-underline text-center px-6 py-4 block transition-colors shadow-sm"
                                href={continueShoppingUrl}
                            >
                                Sepetime Git ve Alışverişi Tamamla
                            </Button>
                        </Section>

                        <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />

                        <Text className="text-[#666666] text-[12px] leading-[24px] text-center">
                            Bu e-posta ilgi duyduğunuz ürünleri size hatırlatmak amacıyla otomatik olarak gönderilmiştir.
                            Bizi tercih ettiğiniz için teşekkür ederiz.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default AbandonedCartNotificationEmail;
