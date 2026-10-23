import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateTotpSecret, totpAuthUri } from "@/lib/totp";
import { TwoFactorForm } from "./two-factor-form";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "İki Adımlı Doğrulama" }, robots: { index: false, follow: false } };

const ISSUER = "Bardakcı Bike Yönetim";

export default async function TwoFactorPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/admin/login");
    // Kod bu tarayıcıda zaten girildiyse panele
    if (!session.user.mfaPending) redirect("/admin");

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, email: true, role: true, twoFactorEnabled: true, twoFactorSecret: true },
    });
    if (!user || (user.role !== "ADMIN" && user.role !== "OPERATOR")) redirect("/");

    if (user.twoFactorEnabled && user.twoFactorSecret) {
        return <TwoFactorForm mode="verify" email={user.email} />;
    }

    // İlk kurulum: anahtar bir kez üretilip saklanır (sayfa yenilense de QR aynı kalır)
    let secret = user.twoFactorSecret;
    if (!secret) {
        secret = generateTotpSecret();
        await prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: secret } });
    }
    const qrDataUrl = await QRCode.toDataURL(totpAuthUri(secret, user.email, ISSUER), { width: 220, margin: 1 });

    return <TwoFactorForm mode="setup" email={user.email} qrDataUrl={qrDataUrl} secret={secret.replace(/(.{4})/g, "$1 ").trim()} />;
}
