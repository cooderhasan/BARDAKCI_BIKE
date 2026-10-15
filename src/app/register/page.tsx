import { getSiteSettings } from "@/lib/settings";
import { RegisterForm } from "@/components/auth/register-form";
import { getStoreType, getStoreSettings } from "@/lib/store-helper";
import { Suspense } from "react";

export const metadata = {
    title: "Kayıt Ol",
    description: "Yeni bir hesap oluşturun.",
};

export default async function RegisterPage() {
    const activeStore = await getStoreType();
    const settings = await getSiteSettings();
    // Mağazaya özel logo/ad (motor sitesinde Moto Vitrin); yoksa genel ayarlar
    const storeSettings = await getStoreSettings(await getStoreType());
    const logoUrl = (storeSettings.logoUrl || settings.logoUrl) as string | undefined;
    const siteName = (storeSettings.siteTitle || settings.siteName) as string | undefined;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4 py-8">
            <Suspense fallback={<div className="flex justify-center p-8">Yükleniyor...</div>}>
                <RegisterForm logoUrl={logoUrl} siteName={siteName} isMotor={activeStore === "MOTOR"} />
            </Suspense>
        </div>
    );
}
