import { prisma } from "@/lib/db";
import { SettingsForm } from "@/components/admin/settings-form";


export default async function SettingsPage() {
    const generalSettings = await prisma.siteSettings.findUnique({
        where: { key: "general" },
    });

    const cargoCompanies = await prisma.cargoCompany.findMany({
        orderBy: { name: "asc" },
    });

    const defaults = {
        siteName: "",
        companyName: "",
        phone: "",
        email: "",
        address: "",
        whatsappNumber: "",
        taxOffice: "",
        taxNumber: "",
        workingHours: "",

        // Branding
        logoUrl: "",
        faviconUrl: "",
        ogImageUrl: "",
        appleTouchIconUrl: "",

        // SEO
        seoTitle: "",
        seoDescription: "",
        seoKeywords: "",

        // Content
        aboutContent: "",
        contactContent: "",
        googleMapsEmbedUrl: "",

        // Social
        facebookUrl: "",
        instagramUrl: "",
        twitterUrl: "",
        linkedinUrl: "",
        tiktokUrl: "",

        // Bank / Payment
        bankName: "",
        bankAccountName: "",
        bankIban1: "",
        bankIban2: "",
        // Analytics & Tracking
        googleAnalyticsId: "",
        metaPixelId: "",
        customBodyScripts: "",
    };

    const settings = { ...defaults, ...((generalSettings?.value as Record<string, string>) || {}) };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Site Ayarları
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Genel site ayarlarını düzenleyin
                </p>
            </div>

            <SettingsForm initialSettings={settings} cargoCompanies={cargoCompanies} />
        </div>
    );
}
