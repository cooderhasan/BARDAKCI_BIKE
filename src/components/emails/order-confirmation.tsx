import * as React from 'react';
import {
    Body,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Img,
    Link,
    Preview,
    Section,
    Text,
    Column,
    Row,
    Tailwind,
} from '@react-email/components';

interface OrderItem {
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
}

interface OrderConfirmationEmailProps {
    orderNumber: string;
    customerName: string;
    items: OrderItem[];
    subtotal: number;
    discountAmount: number;
    vatAmount: number;
    total: number;
    shippingAddress: {
        address: string;
        city: string;
        district?: string;
    };
    paymentMethod?: "BANK_TRANSFER" | "CREDIT_CARD" | "CURRENT_ACCOUNT";
    bankInfo?: {
        bankName: string;
        iban: string;
        accountHolder: string;
    };
    cargoCompany?: string;
}

export const OrderConfirmationEmail = ({
    orderNumber,
    customerName,
    items,
    subtotal,
    discountAmount,
    vatAmount,
    total,
    shippingAddress,
    cargoCompany,
    paymentMethod,
    bankInfo,
}: OrderConfirmationEmailProps) => {
    const formatPrice = (price: number) => {
        return new Intl.NumberFormat("tr-TR", {
            style: "currency",
            currency: "TRY",
        }).format(price);
    };

    return (
        <Html>
            <Head />
            <Preview>Siparişiniz alındı: {orderNumber}</Preview>
            <Tailwind>
                <Body className="bg-white font-sans">
                    <Container className="mx-auto py-5 px-5 w-[580px]">
                        <Heading className="text-2xl font-bold text-gray-900 text-center my-0">
                            Siparişiniz Alındı
                        </Heading>
                        <Text className="text-gray-500 text-center mb-8">
                            Sayın {customerName}, siparişiniz bize ulaştı.
                        </Text>

                        <Section className="bg-gray-50 rounded-lg p-6 mb-6">
                            <Text className="text-gray-900 font-bold m-0 mb-2">
                                Sipariş Numarası:
                            </Text>
                            <Text className="text-[#17457C] text-xl m-0 mb-4">
                                #{orderNumber}
                            </Text>

                            <Hr className="border-gray-200 my-4" />

                            <Text className="text-gray-900 font-bold m-0 mb-2">
                                Teslimat Adresi:
                            </Text>
                            <Text className="text-gray-600 m-0">
                                {shippingAddress.address}
                                <br />
                                {shippingAddress.district && `${shippingAddress.district}, `}
                                {shippingAddress.city}
                            </Text>

                            {cargoCompany && (
                                <>
                                    <Hr className="border-gray-200 my-4" />
                                    <Text className="text-gray-900 font-bold m-0 mb-2">
                                        Kargo Tercihi:
                                    </Text>
                                    <Text className="text-gray-600 m-0">
                                        {cargoCompany}
                                    </Text>
                                </>
                            )}

                            <Hr className="border-gray-200 my-4" />

                            <Text className="text-gray-900 font-bold m-0 mb-2">
                                Kargo Ücreti Durumu:
                            </Text>
                            <Text className={total >= 20000 ? "text-green-600 font-bold m-0" : "text-gray-600 m-0"}>
                                {total >= 20000 ? "Ücretsiz Kargo" : "Alıcı Öder"}
                            </Text>
                        </Section>

                        <Section className="mb-6">
                            <Heading as="h3" className="text-lg font-bold text-gray-900 mb-4">
                                Sipariş Özeti
                            </Heading>

                            {items.map((item, index) => (
                                <Row key={index} className="border-b border-gray-100 py-3">
                                    <Column>
                                        <Text className="m-0 font-medium text-gray-900">
                                            {item.productName}
                                        </Text>
                                        <Text className="m-0 text-gray-500 text-sm">
                                            {item.quantity} Adet x {formatPrice(item.unitPrice)}
                                        </Text>
                                    </Column>
                                    <Column align="right">
                                        <Text className="m-0 font-medium text-gray-900">
                                            {formatPrice(item.lineTotal)}
                                        </Text>
                                    </Column>
                                </Row>
                            ))}
                        </Section>

                        <Section className="bg-gray-50 rounded-lg p-6 mb-6">
                            <Row className="mb-2">
                                <Column>
                                    <Text className="m-0 text-gray-600">Ara Toplam</Text>
                                </Column>
                                <Column align="right">
                                    <Text className="m-0 text-gray-900 font-medium">
                                        {formatPrice(subtotal)}
                                    </Text>
                                </Column>
                            </Row>
                            {discountAmount > 0 && (
                                <Row className="mb-2">
                                    <Column>
                                        <Text className="m-0 text-green-600">İskonto</Text>
                                    </Column>
                                    <Column align="right">
                                        <Text className="m-0 text-green-600 font-medium">
                                            -{formatPrice(discountAmount)}
                                        </Text>
                                    </Column>
                                </Row>
                            )}
                            <Row className="mb-2">
                                <Column>
                                    <Text className="m-0 text-gray-600">KDV</Text>
                                </Column>
                                <Column align="right">
                                    <Text className="m-0 text-gray-900 font-medium">
                                        {formatPrice(vatAmount)}
                                    </Text>
                                </Column>
                            </Row>
                            <Hr className="border-gray-200 my-4" />
                            <Row>
                                <Column>
                                    <Text className="m-0 text-lg font-bold text-gray-900">
                                        Toplam
                                    </Text>
                                </Column>
                                <Column align="right">
                                    <Text className="m-0 text-lg font-bold text-[#17457C]">
                                        {formatPrice(total)}
                                    </Text>
                                </Column>
                            </Row>
                        </Section>

                        {paymentMethod === "BANK_TRANSFER" && bankInfo && (
                            <Section className="bg-gray-50 rounded-lg p-6 mb-6">
                                <Heading as="h3" className="text-lg font-bold text-gray-900 mb-4">
                                    Banka Hesap Bilgileri
                                </Heading>
                                <Text className="text-gray-600 m-0 mb-4">
                                    Lütfen ödemenizi aşağıdaki hesaba yapınız:
                                </Text>
                                <div className="bg-white p-4 rounded border border-gray-200">
                                    <Text className="text-gray-900 font-bold m-0 mb-1">
                                        {bankInfo.bankName}
                                    </Text>
                                    <Text className="text-gray-600 m-0 mb-2">
                                        {bankInfo.accountHolder}
                                    </Text>
                                    <Text className="text-gray-900 font-mono text-lg m-0">
                                        {bankInfo.iban}
                                    </Text>
                                </div>
                                <Text className="text-red-500 text-sm mt-4 font-medium">
                                    * Lütfen açıklama kısmına sipariş numaranızı ({orderNumber}) yazmayı unutmayınız.
                                    <br />
                                    * Ödemenizi 3 iş günü içinde yapmanız gerekmektedir, aksi takdirde siparişiniz iptal edilecektir.
                                </Text>
                            </Section>
                        )}

                        <Section className="text-center">
                            <Text className="text-gray-500 text-xs">
                                Bu otomatik bir e-postadır, lütfen cevaplamayınız.
                            </Text>
                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default OrderConfirmationEmail;
