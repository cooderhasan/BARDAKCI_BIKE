
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
} from "@react-email/components";
import * as React from "react";

interface OrderItem {
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    variantInfo?: string;
}

interface AdminNewOrderEmailProps {
    orderNumber: string;
    orderId: string;
    customerName: string;
    companyName: string;
    totalAmount: number;
    items: OrderItem[];
}

export const AdminNewOrderEmail = ({
    orderNumber,
    orderId,
    customerName,
    companyName,
    totalAmount,
    items,
}: AdminNewOrderEmailProps) => {
    const previewText = `Yeni Sipariş: #${orderNumber} - ${companyName}`;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <Body className="bg-white my-auto mx-auto font-sans">
                    <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] w-[465px]">
                        <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                            Yeni Sipariş Var! 🎉
                        </Heading>
                        <Text className="text-black text-[14px] leading-[24px]">
                            <strong>{companyName}</strong> ({customerName}) yeni bir sipariş oluşturdu.
                        </Text>

                        <Section className="bg-gray-50 p-4 rounded my-4">
                            <Row>
                                <Column>
                                    <Text className="text-gray-500 text-xs uppercase font-bold m-0">Sipariş No</Text>
                                    <Text className="text-lg font-bold m-0">#{orderNumber}</Text>
                                </Column>
                                <Column align="right">
                                    <Text className="text-gray-500 text-xs uppercase font-bold m-0">Toplam Tutar</Text>
                                    <Text className="text-lg font-bold m-0 text-green-600">
                                        {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(totalAmount)}
                                    </Text>
                                </Column>
                            </Row>
                        </Section>

                        <Text className="text-black text-[14px] font-bold mt-4 mb-2">Sipariş Edilen Ürünler:</Text>
                        <Section className="mb-4">
                            {items && items.length > 0 ? (
                                items.map((item, index) => (
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
                                ))
                            ) : (
                                <Text className="text-gray-500 text-xs italic">Ürün bilgisi bulunamadı.</Text>
                            )}
                        </Section>

                        <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />

                        <Section className="text-center mt-8">
                            <Link
                                href={`https://www.bardakcibike.com.tr/admin/orders/${orderId}`}
                                className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
                            >
                                Siparişi Görüntüle
                            </Link>
                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default AdminNewOrderEmail;
