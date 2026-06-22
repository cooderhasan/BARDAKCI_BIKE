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
} from "@react-email/components";
import * as React from "react";

interface ShippingNotificationEmailProps {
    orderNumber: string;
    customerName: string;
    cargoCompany: string;
    trackingUrl: string;
}

export const ShippingNotificationEmail = ({
    orderNumber,
    customerName,
    cargoCompany,
    trackingUrl,
}: ShippingNotificationEmailProps) => {
    const previewText = `Siparişiniz Kargolandı - #${orderNumber}`;

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <Body className="bg-white my-auto mx-auto font-sans">
                    <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] w-[465px]">
                        <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                            Siparişiniz Yola Çıktı! 🚀
                        </Heading>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Merhaba <strong>{customerName}</strong>,
                        </Text>
                        <Text className="text-black text-[14px] leading-[24px]">
                            <strong>#{orderNumber}</strong> numaralı siparişinizin kargoya verildiğini bildirmekten mutluluk duyarız.
                        </Text>

                        <Section className="bg-blue-50 p-4 rounded-lg border border-blue-100 my-6 text-center">
                            <Text className="text-gray-600 text-xs font-bold uppercase tracking-wider mb-2">
                                KARGO FİRMASI
                            </Text>
                            <Text className="text-gray-900 text-lg font-bold m-0 mb-4">
                                {cargoCompany}
                            </Text>

                            <Button
                                className="bg-[#17457C] text-white font-bold px-6 py-3 rounded-md text-[14px]"
                                href={trackingUrl}
                            >
                                Kargo Takip
                            </Button>
                        </Section>

                        <Text className="text-black text-[14px] leading-[24px]">
                            Yukarıdaki butona tıklayarak kargonuzun durumunu takip edebilirsiniz.
                        </Text>

                        <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />

                        <Text className="text-[#666666] text-[12px] leading-[24px] mt-8 text-center">
                            Teşekkür ederiz.<br />
                            Bu e-posta otomatik olarak gönderilmiştir.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default ShippingNotificationEmail;
