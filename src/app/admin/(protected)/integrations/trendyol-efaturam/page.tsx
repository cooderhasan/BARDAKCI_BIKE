import { getEFaturamConfig } from "./actions";
import { EFaturamSettingsForm } from "./efaturam-settings-form";
import { FileText, ShieldCheck, Zap } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function TrendyolEFaturamPage() {
    const { data: config } = await getEFaturamConfig();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Trendyol e-Faturam</h1>
                    <p className="text-muted-foreground">
                        Siparişlerinizi tek tıkla e-faturaya dönüştürün.
                    </p>
                </div>
            </div>

            <Alert className="bg-orange-50 border-orange-200">
                <Zap className="h-4 w-4 text-orange-500" />
                <AlertTitle className="text-orange-800">Entegrasyon Bilgisi</AlertTitle>
                <AlertDescription className="text-orange-700">
                    Sipariş listesinde "Fatura Gönder" butonu aktif olacaktır. Gönderilen faturalar Trendyol e-Faturam panelinde taslak olarak oluşur.
                </AlertDescription>
            </Alert>

            <div className="grid gap-6 md:grid-cols-2">
                <div>
                    <EFaturamSettingsForm initialData={config} />
                </div>

                <div className="space-y-6">
                    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-6">
                        <div className="flex items-center gap-2 font-semibold">
                            <ShieldCheck className="w-5 h-5 text-green-600" />
                            Neden Trendyol e-Faturam?
                        </div>
                        
                        <div className="grid gap-4">
                            <div className="flex items-start gap-3">
                                <div className="mt-1 bg-blue-100 p-2 rounded-full text-[#17457C]">
                                    <FileText className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Otomatik Mükellef Kontrolü</p>
                                    <p className="text-xs text-muted-foreground">Müşteri e-fatura mükellefi mi değil mi sistem otomatik anlar.</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="mt-1 bg-green-100 p-2 rounded-full text-green-600">
                                    <Zap className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Zamandan Tasarruf</p>
                                    <p className="text-xs text-muted-foreground">Fatura bilgilerini manuel girmekle uğraşmazsınız.</p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t">
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                <strong>Önemli:</strong> Fatura kesebilmek için müşterinin Ad Soyad, VKN/TCKN ve Adres bilgilerinin eksiksiz olması gerekmektedir. Eksik bilgi içeren siparişlerde sistem sizi uyaracaktır.
                            </p>
                        </div>
                    </div>

                    <div className="rounded-lg border bg-blue-50/50 p-6">
                        <h4 className="text-sm font-semibold mb-2">Hızlı Yardım</h4>
                        <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside">
                            <li>Test hesabı için Trendyol panelinden IP onayı almanız gerekir.</li>
                            <li>Canlı modda gerçek fatura kontörleriniz harcanır.</li>
                            <li>Hatalı kesilen faturaları sadece Trendyol e-Faturam panelinden iptal edebilirsiniz.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
