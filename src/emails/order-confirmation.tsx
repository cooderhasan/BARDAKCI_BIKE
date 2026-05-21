
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
} from "@react-email/components";
import * as React from "react";
import { formatPrice } from "@/lib/helpers"; // Assuming helpers are available or I'll inline formatPrice

// Define interfaces locally to avoid import issues in email templates sometimes
interface OrderItem {
    productName: string;
    quantity: number;
    unitPrice: number; // or Decimal converted
    lineTotal: number;
    variantInfo?: string;
}

interface OrderConfirmationEmailProps {
    orderNumber: string;
    customerName: string;
    items: OrderItem[];
    totalAmount: number;
    paymentMethod: "BANK_TRANSFER" | "CREDIT_CARD" | "CURRENT_ACCOUNT";
    bankInfo?: {
        bankName: string;
        iban: string;
        accountHolder: string;
    };
}

export const OrderConfirmationEmail = ({
    orderNumber,
    customerName,
    items,
    totalAmount,
    paymentMethod,
    bankInfo,
}: OrderConfirmationEmailProps) => {
    const previewText = `Siparişiniz Alındı - #${orderNumber}`;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <Body className="bg-white my-auto mx-auto font-sans">
                    <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] w-[465px]">
                        <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                            Siparişiniz Alındı
                        </Heading>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Merhaba <strong>{customerName}</strong>,
                        </Text>
                        <Text className="text-black text-[14px] leading-[24px]">
                            <strong>#{orderNumber}</strong> numaralı siparişiniz başarıyla oluşturuldu.
                            Sipariş detaylarınızı aşağıda bulabilirsiniz.
                        </Text>

                        <Section className="mt-[32px] mb-[32px]">
                            {items.map((item, index) => (
                                <Row key={index} className="border-b border-gray-200 pb-2 mb-2">
                                    <Column>
                                        <Text className="m-0 text-sm font-semibold">{item.productName}</Text>
                                        {item.variantInfo && (
                                            <Text className="m-0 text-xs text-gray-500 italic">Varyant: {item.variantInfo}</Text>
                                        )}
                                        <Text className="m-0 text-xs text-gray-500">
                                            {item.quantity} adet x {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(item.unitPrice)}
                                        </Text>
                                    </Column>
                                    <Column align="right">
                                        <Text className="m-0 text-sm font-semibold">
                                            {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(item.lineTotal)}
                                        </Text>
                                    </Column>
                                </Row>
                            ))}
                        </Section>

                        <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />

                        <Section>
                            <Row>
                                <Column>
                                    <Text className="text-[16px] font-bold m-0">Toplam Tutar:</Text>
                                </Column>
                                <Column align="right">
                                    <Text className="text-[20px] font-bold m-0 text-green-600">
                                        {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(totalAmount)}
                                    </Text>
                                </Column>
                            </Row>
                        </Section>

                        <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />

                        {paymentMethod === "BANK_TRANSFER" && bankInfo && (
                            <Section className="bg-gray-50 p-4 rounded text-center border border-gray-200">
                                <Text className="text-sm font-bold m-0 mb-2">Havale/EFT Bilgileri</Text>
                                <Text className="text-sm m-0">{bankInfo.bankName}</Text>
                                <Text className="text-sm m-0 font-medium">{bankInfo.accountHolder}</Text>
                                <Text className="text-sm m-0 font-mono select-all bg-white p-1 rounded border border-gray-200 mt-1">
                                    {bankInfo.iban}
                                </Text>
                                <Text className="text-xs text-gray-500 mt-2">
                                    Lütfen açıklama kısmına <strong>#{orderNumber}</strong> yazmayı unutmayınız.
                                </Text>
                            </Section>
                        )}

                        <Text className="text-[#666666] text-[12px] leading-[24px] mt-8 text-center">
                            Bu e-posta otomatik olarak gönderilmiştir.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default OrderConfirmationEmail;
