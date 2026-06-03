import { getSiteSettings } from "@/lib/settings";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Suspense } from "react";

export const metadata = {
    title: "Şifre Sıfırla",
    description: "Yeni şifrenizi belirleyin.",
};

export default async function ResetPasswordPage() {
    const settings = await getSiteSettings();
    const logoUrl = settings.logoUrl as string | undefined;
    const siteName = settings.siteName as string | undefined;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 px-4 py-8">
            {/* Decorative Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200/30 dark:bg-blue-500/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-200/30 dark:bg-blue-500/10 rounded-full blur-3xl" />
            </div>

            <Suspense fallback={<div className="flex justify-center p-8">Yükleniyor...</div>}>
                <ResetPasswordForm logoUrl={logoUrl} siteName={siteName} />
            </Suspense>
        </div>
    );
}
