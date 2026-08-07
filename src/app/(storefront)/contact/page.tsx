import { Card, CardContent } from "@/components/ui/card";
import { Mail, MapPin, Phone, Clock, Building2, FileText, MessageCircle } from "lucide-react";
import { getSiteSettings } from "@/lib/settings";
import { getStoreType, getStoreSettings } from "@/lib/store-helper";
import { ContactForm } from "@/components/storefront/contact-form";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
    const activeStore = await getStoreType();
    const isMotor = activeStore === "MOTOR";
    const title = isMotor ? "İletişim | Motovitrin" : "İletişim | Bardakcı Bike";
    const description = isMotor
        ? "Motovitrin ile iletişime geçin. Motosiklet yedek parça, aksesuar talepleriniz ve bayi başvurusu için bize ulaşabilirsiniz."
        : "Bardakcı Bike ile iletişime geçin. Sorularınız, talepleriniz ve bayi başvurusu için bize ulaşabilirsiniz.";

    return {
        title,
        description,
        alternates: {
            canonical: "/contact",
        },
    };
}

export default async function ContactPage() {
    const activeStore = await getStoreType();
    const storeSettings = await getStoreSettings(activeStore);
    const settings = await getSiteSettings();
    const isMotor = activeStore === "MOTOR";

    const companyName = isMotor ? "Motovitrin Motosiklet - Mehmet Fatih Bardakcı" : (settings.companyName || "Bardakcı Bike - Mehmet Fatih Bardakcı");
    const subtext = isMotor
        ? "Motosiklet dünyasında ihtiyacınız olan orijinal yedek parça ve aksesuarlara ulaşmanız için her zaman yanınızdayız."
        : "Hayalinizdeki bisiklet modeline ulaşmanız için her zaman yanınızdayız. Sorularınız için bize ulaşın.";

    return (
        <div className="min-h-screen">
            {/* Hero Banner */}
            <section className={`relative bg-gradient-to-br ${isMotor ? 'from-[#800000] via-[#b71c1c] to-[#1a0000]' : 'from-[#002838] via-[#004a6e] to-[#17457C]'} py-16 sm:py-20 overflow-hidden`}>
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4" />

                <div className="container mx-auto px-4 relative z-10 text-center">
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4 tracking-tight">
                        Bize Ulaşın
                    </h1>
                    <p className="text-white/90 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
                        {subtext}
                    </p>
                </div>
            </section>

            {/* Quick Contact Badges */}
            <section className="container mx-auto px-4 -mt-8 relative z-20 mb-10">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <a href={`tel:${storeSettings.phone.replace(/[^0-9+]/g, '')}`} className="group flex items-center gap-4 bg-white dark:bg-gray-900 rounded-2xl shadow-lg hover:shadow-xl p-5 ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1">
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-500 transition-colors">
                            <Phone className="w-5 h-5 text-green-600 group-hover:text-white transition-colors" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Telefon</p>
                            <p className="font-bold text-gray-900 dark:text-white text-sm">{storeSettings.phone}</p>
                        </div>
                    </a>

                    <a href={`mailto:${storeSettings.email}`} className="group flex items-center gap-4 bg-white dark:bg-gray-900 rounded-2xl shadow-lg hover:shadow-xl p-5 ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1">
                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-500 transition-colors">
                            <Mail className="w-5 h-5 text-purple-600 group-hover:text-white transition-colors" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">E-posta</p>
                            <p className="font-bold text-gray-900 dark:text-white text-sm">{storeSettings.email}</p>
                        </div>
                    </a>

                    {(() => {
                        let cleanPhone = (settings.whatsappNumber || storeSettings.phone).replace(/[^0-9]/g, "");
                        if (cleanPhone.startsWith('0')) cleanPhone = '90' + cleanPhone.substring(1);
                        else if (!cleanPhone.startsWith('90') && cleanPhone.length === 10) cleanPhone = '90' + cleanPhone;

                        return (
                            <a href={`https://wa.me/${cleanPhone}`} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-4 bg-white dark:bg-gray-900 rounded-2xl shadow-lg hover:shadow-xl p-5 ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1">
                                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center group-hover:bg-emerald-500 transition-colors">
                                    <MessageCircle className="w-5 h-5 text-emerald-600 group-hover:text-white transition-colors" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">WhatsApp</p>
                                    <p className="font-bold text-gray-900 dark:text-white text-sm">Hızlı İletişim</p>
                                </div>
                            </a>
                        );
                    })()}
                </div>
            </section>

            {/* Main Content */}
            <section className="container mx-auto px-4 pb-16">
                <div className="grid gap-8 lg:grid-cols-5">
                    {/* Left: Company Details */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Company Info */}
                        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg ring-1 ring-black/5 overflow-hidden">
                            <div className={`bg-gradient-to-r ${isMotor ? 'from-[#990000] to-[#111111]' : 'from-[#17457C] to-[#0f3460]'} px-6 py-4`}>
                                <h2 className="text-white font-bold text-lg flex items-center gap-2">
                                    <Building2 className="w-5 h-5" />
                                    Firma Bilgileri
                                </h2>
                            </div>
                            <div className="p-6 space-y-5">
                                {/* Company Name */}
                                <div>
                                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Firma Ünvanı</p>
                                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                                        {companyName}
                                    </p>
                                </div>

                                {/* Address */}
                                <div className="flex gap-3">
                                    <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <MapPin className={`w-4 h-4 ${isMotor ? 'text-red-600' : 'text-[#17457C]'}`} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-0.5">Adres</p>
                                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                            {storeSettings.address || "Horozluhan Mah. Ayça Sk. No:62 Selçuklu / KONYA"}
                                        </p>
                                    </div>
                                </div>

                                {/* Phones */}
                                <div className="flex gap-3">
                                    <div className="w-9 h-9 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <Phone className="w-4 h-4 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-0.5">Telefon</p>
                                        <a href={`tel:${storeSettings.phone.replace(/[^0-9+]/g, '')}`} className="block text-sm text-gray-700 dark:text-gray-300 hover:text-red-600 transition-colors font-medium">
                                            {storeSettings.phone}
                                        </a>
                                    </div>
                                </div>

                                {/* Working Hours */}
                                <div className="flex gap-3">
                                    <div className="w-9 h-9 bg-orange-50 dark:bg-orange-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <Clock className="w-4 h-4 text-orange-500" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-0.5">Çalışma Saatleri</p>
                                        <div className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                                            {settings.workingHours ? (
                                                <p>{settings.workingHours}</p>
                                            ) : (
                                                <>
                                                    <p>Hafta içi ve Cumartesi: 08:00 - 20:00</p>
                                                    <p className="text-xs text-red-500 font-semibold mt-0.5">
                                                        Pazar: 10:00 - 20:00
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Tax Info */}
                                <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                                    <div className="w-9 h-9 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <FileText className="w-4 h-4 text-gray-500" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-0.5">Vergi Bilgileri</p>
                                        <p className="text-sm text-gray-700 dark:text-gray-300">
                                            V.D.: <span className="font-semibold">{settings.taxOffice || "Meram"}</span> &nbsp;|&nbsp; V.N.: <span className="font-semibold">{settings.taxNumber || "2030321343"}</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Google Maps */}
                        <div className="h-72 sm:h-80 bg-gray-100 rounded-2xl overflow-hidden shadow-lg ring-1 ring-black/5">
                            <iframe
                                src={settings.googleMapsEmbedUrl || "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3148.5!2d32.48!3d37.87!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzfCsDUyJzAwLjAiTiAzMsKwMjknMDAuMCJF!5e0!3m2!1str!2str!4v1620000000000!5m2!1str!2str"}
                                width="100%"
                                height="100%"
                                style={{ border: 0 }}
                                allowFullScreen
                                loading="lazy"
                                title="Konya Konum"
                            ></iframe>
                        </div>
                    </div>

                    {/* Right: Contact Form */}
                    <div className="lg:col-span-3">
                        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg ring-1 ring-black/5 overflow-hidden h-full flex flex-col">
                            <div className={`bg-gradient-to-r ${isMotor ? 'from-[#990000] to-[#111111]' : 'from-[#17457C] to-[#0f3460]'} px-6 py-4`}>
                                <h2 className="text-white font-bold text-lg">Mesaj Gönderin</h2>
                                <p className="text-white/80 text-sm mt-0.5">
                                    Formu doldurarak bize mesaj gönderin, en kısa sürede dönüş yapacağız.
                                </p>
                            </div>
                            <div className="p-6 flex-1 flex flex-col">
                                <ContactForm />
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
