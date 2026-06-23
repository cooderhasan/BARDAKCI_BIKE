import { Card, CardContent } from "@/components/ui/card";
import { Building2, Users, Target, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { getSiteSettings } from "@/lib/settings";

export default async function AboutPage() {
    const settings = await getSiteSettings();

    return (
        <div className="container mx-auto px-4 py-12">
            {/* Hero Section */}
            <div className="text-center mb-16 space-y-4">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                    Hakkımızda
                </h1>
                <p className="text-xl text-gray-500 max-w-2xl mx-auto">
                    {settings.seoDescription || "20 yılı aşkın tecrübemizle en kaliteli bisiklet modellerini sizlerle buluşturuyor, sürüş keyfinizi güvenle destekliyoruz."}
                </p>
            </div>

            {/* Dynamic Content or Static Fallback */}
            {settings.aboutContent ? (
                <div className="prose prose-lg dark:prose-invert max-w-none mb-24">
                    <div dangerouslySetInnerHTML={{ __html: settings.aboutContent }} />
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
                                Sektördeki en kaliteli ürünleri, en uygun fiyatlarla ve en hızlı şekilde iş ortaklarımıza ulaştırmayı hedefliyoruz. Teknolojiye yaptığımız yatırımlarla tedarik süreçlerini dijitalleştiriyor, verimliliği artırıyoruz.
                            </p>
                            <p className="text-lg text-gray-600 dark:text-gray-300">
                                Müşteri memnuniyetini her zaman ön planda tutarak, sürdürülebilir ve karşılıklı kazanca dayalı iş birlikleri kuruyoruz.
                            </p>
                        </div>
                        <div className="relative h-[400px] rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
                                <Building2 className="w-32 h-32 opacity-20" />
                            </div>
                        </div>
                    </div>

                    {/* Values Grid */}
                    <div className="grid gap-8 md:grid-cols-3 mb-16">
                        <Card>
                            <CardContent className="pt-6 text-center space-y-4">
                                <div className="w-12 h-12 bg-blue-100 text-[#17457C] rounded-full flex items-center justify-center mx-auto">
                                    <ShieldCheck className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-bold">Güvenilirlik</h3>
                                <p className="text-gray-500">
                                    İş ortaklarımızla şeffaf ve güvene dayalı ilişkiler kuruyoruz.
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
                                    Her zaman en kaliteli ürün ve hizmeti sunmayı taahhüt ediyoruz.
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
