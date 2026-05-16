
import {
    Body,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Link,
    Preview,
    Section,
    Text,
    Tailwind,
    Row,
    Column,
    Button,
} from "@react-email/components";
import * as React from "react";

interface InvoiceNotificationEmailProps {
    orderNumber: string;
    customerName: string;
    invoiceNo: string;
    invoiceUrl: string;
    totalAmount: number;
    invoiceDate: string;
}

export const InvoiceNotificationEmail = ({
    orderNumber,
    customerName,
    invoiceNo,
    invoiceUrl,
    totalAmount,
    invoiceDate,
}: InvoiceNotificationEmailProps) => {
    const previewText = `Faturanız Hazır - #${orderNumber}`;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <Body className="bg-white my-auto mx-auto font-sans">
                    <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] w-[465px]">
                        <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                            🧾 Faturanız Hazır
                        </Heading>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Merhaba <strong>{customerName}</strong>,
                        </Text>
                        <Text className="text-black text-[14px] leading-[24px]">
                            <strong>#{orderNumber}</strong> numaralı siparişinize ait fatura
                            başarıyla oluşturulmuştur.
                        </Text>

                        <Section className="bg-gray-50 p-4 rounded border border-gray-200 my-[24px]">
                            <Row>
                                <Column>
                                    <Text className="text-sm text-gray-600 m-0">Fatura No:</Text>
                                </Column>
                                <Column align="right">
                                    <Text className="text-sm font-bold m-0">{invoiceNo}</Text>
                                </Column>
                            </Row>
                            <Row>
                                <Column>
                                    <Text className="text-sm text-gray-600 m-0">Tarih:</Text>
                                </Column>
                                <Column align="right">
                                    <Text className="text-sm font-medium m-0">{invoiceDate}</Text>
                                </Column>
                            </Row>
                            <Row>
                                <Column>
                                    <Text className="text-sm text-gray-600 m-0">Toplam Tutar:</Text>
                                </Column>
                                <Column align="right">
                                    <Text className="text-sm font-bold text-green-600 m-0">
                                        {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(totalAmount)}
                                    </Text>
                                </Column>
                            </Row>
                        </Section>

                        <Section className="text-center my-[32px]">
                            <Button
                                className="bg-[#2563eb] rounded text-white text-[14px] font-semibold no-underline text-center px-5 py-3"
                                href={invoiceUrl}
                            >
                                📄 Faturayı İndir (PDF)
                            </Button>
                        </Section>

                        <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />

                        <Text className="text-[#666666] text-[12px] leading-[24px] text-center">
                            Faturanızı yukarıdaki butona tıklayarak PDF formatında indirebilirsiniz.
                        </Text>
                        <Text className="text-[#666666] text-[12px] leading-[24px] text-center">
                            Bu e-posta otomatik olarak gönderilmiştir.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default InvoiceNotificationEmail;
