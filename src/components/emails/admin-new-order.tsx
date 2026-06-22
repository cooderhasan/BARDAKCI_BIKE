import * as React from 'react';
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
    Column,
    Row,
    Tailwind,
    Button
} from '@react-email/components';

interface AdminNewOrderEmailProps {
    orderNumber: string;
    customerName: string;
    total: number;
    orderId: string;
    cargoCompany?: string;
}

export const AdminNewOrderEmail = ({
    orderNumber,
    customerName,
    total,
    orderId,
    cargoCompany,
}: AdminNewOrderEmailProps) => {
    const formatPrice = (price: number) => {
        return new Intl.NumberFormat("tr-TR", {
            style: "currency",
            currency: "TRY",
        }).format(price);
    };

    const adminUrl = process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/admin/orders/${orderId}`
        : `http://localhost:3000/admin/orders/${orderId}`;

    return (
        <Html>
            <Head />
            <Preview>Yeni Sipariş: {orderNumber} - {customerName}</Preview>
            <Tailwind>
                <Body className="bg-white font-sans">
                    <Container className="mx-auto py-5 px-5 w-[580px]">
                        <Heading className="text-2xl font-bold text-gray-900 text-center my-0">
                            Yeni Sipariş Alındı! 🚀
                        </Heading>
                        <Text className="text-gray-500 text-center mb-8">
                            Tebrikler! Yeni bir siparişiniz var.
                        </Text>

                        <Section className="bg-gray-50 rounded-lg p-6 mb-6">
                            <Row className="mb-4">
                                <Column>
                                    <Text className="font-bold text-gray-900 m-0">Müşteri:</Text>
                                    <Text className="text-gray-600 m-0">{customerName}</Text>
                                </Column>
                                <Column align="right">
                                    <Text className="font-bold text-gray-900 m-0">Sipariş No:</Text>
                                    <Text className="text-[#17457C] font-medium m-0">#{orderNumber}</Text>
                                </Column>
                            </Row>

                            <Row>
                                <Column>
                                    <Text className="font-bold text-gray-900 m-0">Toplam Tutar:</Text>
                                    <Text className="text-green-600 font-bold text-lg m-0">{formatPrice(total)}</Text>
                                </Column>
                            </Row>

                            {cargoCompany && (
                                <Row className="mt-4">
                                    <Column>
                                        <Text className="font-bold text-gray-900 m-0">Kargo Tercihi:</Text>
                                        <Text className="text-gray-600 m-0">{cargoCompany}</Text>
                                    </Column>
                                </Row>
                            )}

                            <Row className="mt-4">
                                <Column>
                                    <Text className="font-bold text-gray-900 m-0">Kargo Durumu:</Text>
                                    <Text className={total >= 20000 ? "text-green-600 font-bold m-0" : "text-gray-600 m-0"}>
                                        {total >= 20000 ? "Satıcı Öder (Ücretsiz)" : "Alıcı Öder"}
                                    </Text>
                                </Column>
                            </Row>
                        </Section>

                        <Section className="text-center">
                            <Button
                                className="bg-[#17457C] text-white font-bold px-6 py-3 rounded-md cursor-pointer"
                                href={adminUrl}
                            >
                                Siparişi Görüntüle
                            </Button>
                        </Section>

                        <Hr className="border-gray-200 my-6" />

                        <Section className="text-center">
                            <Text className="text-gray-400 text-xs">
                                Bu otomatik bir bildirim e-postasıdır.
                            </Text>
                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default AdminNewOrderEmail;
