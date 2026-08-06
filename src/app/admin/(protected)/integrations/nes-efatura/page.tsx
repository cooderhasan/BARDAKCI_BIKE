import { getNesConfig } from "./actions";
import { NesSettingsForm } from "./nes-settings-form";
import { FileText, ShieldCheck, Zap, Key, Globe } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function NesEFaturaPage() {
    const { data: config } = await getNesConfig();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">NES E-Fatura / E-Arşiv</h1>
                    <p className="text-muted-foreground">
                        NES Bilgi altyapısı ile e-Fatura ve e-Arşiv Fatura kesimi.
                    </p>
                </div>
            </div>

            <Alert className="bg-blue-50 border-blue-200">
                <Zap className="h-4 w-4 text-blue-500" />
                <AlertTitle className="text-blue-800">Nasıl Çalışır?</AlertTitle>
                <AlertDescription className="text-blue-700">
                    Sipariş listesinde <strong>"Fatura Gönder"</strong> butonuna tıkladığınızda sistem alıcının e-Fatura mükellefi olup olmadığını otomatik sorgular. Mükellef ise <strong>e-Fatura</strong>, değilse <strong>e-Arşiv</strong> kesilir. Pazaryeri siparişlerinde fatura linki otomatik iletilir.
                </AlertDescription>
            </Alert>

            <div className="grid gap-6 md:grid-cols-2">
                <div>
                    <NesSettingsForm initialData={config} />
                </div>

                <div className="space-y-6">
                    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-6">
                        <div className="flex items-center gap-2 font-semibold">
                            <ShieldCheck className="w-5 h-5 text-green-600" />
                            NES Entegrasyon Bilgileri
                        </div>

                        <div className="grid gap-4">
                            <div className="flex items-start gap-3">
                                <div className="mt-1 bg-blue-100 p-2 rounded-full text-blue-700">
                                    <Key className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">API Anahtarı Nasıl Alınır?</p>
                                    <p className="text-xs text-muted-foreground">
                                        NES Portal → Yönetim Paneli → API Tanımları → Yeni API Anahtarı
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="mt-1 bg-green-100 p-2 rounded-full text-green-600">
                                    <FileText className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Gönderici Etiketi (Alias)</p>
                                    <p className="text-xs text-muted-foreground">
                                        NES Portal'dan firma etiketinizi öğrenin. Genelde <code className="bg-muted px-1 rounded text-xs">urn:mail:defaultgb@...</code> formatındadır.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="mt-1 bg-purple-100 p-2 rounded-full text-purple-600">
                                    <Globe className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Test & Canlı Ortam</p>
                                    <p className="text-xs text-muted-foreground">
                                        Test: <code className="bg-muted px-1 rounded text-xs">apitest.nes.com.tr</code><br />
                                        Canlı: <code className="bg-muted px-1 rounded text-xs">api.nes.com.tr</code>
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t">
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                <strong>Önemli:</strong> NES, UBL-TR XML formatında fatura gönderimini destekler.
                                E-Fatura için alıcının e-Fatura mükellefi olması gerekir; sistem bunu otomatik sorgular.
                            </p>
                        </div>
                    </div>

                    <div className="rounded-lg border bg-blue-50/50 p-6">
                        <h4 className="text-sm font-semibold mb-2">Hızlı Yardım</h4>
                        <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside">
                            <li>Test modunda gerçek GİB'e fatura gönderilmez.</li>
                            <li>Canlı modda gerçek e-Fatura kontörleriniz harcanır.</li>
                            <li>Hatalı faturaları NES Portal'dan iptal edebilirsiniz.</li>
                            <li>
                                <a href="https://developertest.nes.com.tr" target="_blank" rel="noopener noreferrer" className="underline text-blue-600">
                                    NES Developer Portal →
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
