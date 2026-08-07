import { Card, CardContent } from "@/components/ui/card";
import { Building2, Users, Target, ShieldCheck } from "lucide-react";
import { getSiteSettings } from "@/lib/settings";
import { getStoreType, getStoreSettings } from "@/lib/store-helper";
import { adaptTextForStore } from "@/lib/default-policies";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
    const activeStore = await getStoreType();
    const isMotor = activeStore === "MOTOR";
    const title = isMotor ? "Hakkımızda | Motovitrin" : "Hakkımızda | Bardakcı Bike";
    const description = isMotor
        ? "Motovitrin olarak en kaliteli motosiklet yedek parça ve aksesuarlarını uygun fiyatlarla sunuyoruz."
        : "Bardakcı Bike olarak 20 yılı aşkın tecrübemizle en kaliteli bisiklet modellerini sunuyoruz.";

    return {
        title,
        description,
        alternates: {
            canonical: "/about",
        },
    };
}

export default async function AboutPage() {
    const activeStore = await getStoreType();
    const storeSettings = await getStoreSettings(activeStore);
    const settings = await getSiteSettings();
    const isMotor = activeStore === "MOTOR";

    const defaultDesc = isMotor
        ? "20 yılı aşkın tecrübemizle en kaliteli motosiklet yedek parça ve aksesuarlarını sizlerle buluşturuyor, güvenli sürüş deneyiminizi destekliyoruz."
        : "20 yılı aşkın tecrübemizle en kaliteli bisiklet modellerini sizlerle buluşturuyor, sürüş keyfinizi güvenle destekliyoruz.";

    const aboutText = settings.aboutContent 
        ? adaptTextForStore(settings.aboutContent, activeStore)
        : null;

    return (
        <div className="container mx-auto px-4 py-12">
            {/* Hero Section */}
            <div className="text-center mb-16 space-y-4">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                    Hakkımızda
                </h1>
                <p className="text-xl text-gray-500 max-w-2xl mx-auto">
                    {storeSettings.seoDescription || defaultDesc}
                </p>
            </div>

            {/* Dynamic Content or Static Fallback */}
            {aboutText ? (
                <div className="prose prose-lg dark:prose-invert max-w-none mb-24">
                    <div dangerouslySetInnerHTML={{ __html: aboutText }} />
                </div>
            ) : (
                <>
                    {/* Main Content (Static Fallback) */}
                    <div className="grid gap-12 lg:grid-cols-2 items-center mb-24">
                        <div className="space-y-6">
                            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                                Vizyonumuz ve Misyonumuz
                            </h2>
                            <p className="text-lg text-gray-600 dark:text-gray-300">
                                Sektördeki en kaliteli {isMotor ? "motosiklet yedek parça ve aksesuarlarını" : "bisiklet ürünlerini"}, en uygun fiyatlarla ve en hızlı şekilde iş ortaklarımıza ve müşterilerimize ulaştırmayı hedefliyoruz.
                            </p>
                            <p className="text-lg text-gray-600 dark:text-gray-300">
                                Müşteri memnuniyetini her zaman ön planda tutarak, sürdürülebilir ve karşılıklı kazanca dayalı güvenilir iş birlikleri kuruyoruz.
                            </p>
                        </div>
                        <div className="relative h-[400px] rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800">
                            <div className={`absolute inset-0 bg-gradient-to-br ${isMotor ? 'from-red-600 to-amber-700' : 'from-blue-600 to-purple-700'} flex items-center justify-center text-white`}>
                                <Building2 className="w-32 h-32 opacity-20" />
                            </div>
                        </div>
                    </div>

                    {/* Values Grid */}
                    <div className="grid gap-8 md:grid-cols-3 mb-16">
                        <Card>
                            <CardContent className="pt-6 text-center space-y-4">
                                <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center mx-auto">
                                    <ShieldCheck className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-bold">Güvenilirlik</h3>
                                <p className="text-gray-500">
                                    Müşterilerimiz ve iş ortaklarımızla şeffaf ve güvene dayalı ilişkiler kuruyoruz.
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6 text-center space-y-4">
                                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                                    <Target className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-bold">Kalite Odaklılık</h3>
                                <p className="text-gray-500">
                                    Orijinal, garantili ve yüksek standartlarda ürünleri sunmayı taahhüt ediyoruz.
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6 text-center space-y-4">
                                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto">
                                    <Users className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-bold">Müşteri Memnuniyeti</h3>
                                <p className="text-gray-500">
                                    Çözüm odaklı yaklaşımımızla 7/24 müşterilerimizin yanındayız.
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}
