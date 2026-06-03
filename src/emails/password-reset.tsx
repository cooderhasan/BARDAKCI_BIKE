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
    Link,
} from "@react-email/components";
import * as React from "react";

interface PasswordResetEmailProps {
    customerName: string;
    resetUrl: string;
    expiresInMinutes: number;
}

export const PasswordResetEmail = ({
    customerName,
    resetUrl,
    expiresInMinutes = 60,
}: PasswordResetEmailProps) => {
    const previewText = "Şifre Sıfırlama Talebi";

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <Body className="bg-white my-auto mx-auto font-sans">
                    <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] w-[465px]">
                        <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                            Şifre Sıfırlama
                        </Heading>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Merhaba <strong>{customerName}</strong>,
                        </Text>
                        <Text className="text-black text-[14px] leading-[24px]">
                            Hesabınız için bir şifre sıfırlama talebi aldık.
                            Şifrenizi sıfırlamak için aşağıdaki butona tıklayın:
                        </Text>

                        <Section className="text-center mt-[32px] mb-[32px]">
                            <Link
                                href={resetUrl}
                                className="bg-[#009AD0] text-white px-6 py-3 rounded-lg text-[14px] font-semibold no-underline"
                            >
                                Şifremi Sıfırla
                            </Link>
                        </Section>

                        <Text className="text-[#666666] text-[13px] leading-[20px]">
                            Bu link <strong>{expiresInMinutes} dakika</strong> süreyle geçerlidir.
                            Süre dolduktan sonra yeni bir sıfırlama talebi oluşturmanız gerekecektir.
                        </Text>

                        <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />

                        <Text className="text-[#666666] text-[12px] leading-[20px]">
                            Eğer bu talebi siz yapmadıysanız, bu e-postayı güvenle
                            görmezden gelebilirsiniz. Şifreniz değiştirilmeyecektir.
                        </Text>

                        <Text className="text-[#999999] text-[11px] leading-[20px] mt-4">
                            Link çalışmıyorsa aşağıdaki URL&apos;yi tarayıcınıza yapıştırın:
                        </Text>
                        <Text className="text-[#009AD0] text-[11px] leading-[20px] break-all">
                            {resetUrl}
                        </Text>

                        <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />

                        <Text className="text-[#666666] text-[12px] leading-[24px] text-center">
                            Bu e-posta otomatik olarak gönderilmiştir.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default PasswordResetEmail;
