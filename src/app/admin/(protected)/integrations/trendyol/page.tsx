
import { getTrendyolConfig, getTrendyolCargoAndAddresses } from "./actions";
import Link from "next/link";
import { TrendyolSettingsForm } from "./trendyol-settings-form";
import { TrendyolSyncButton } from "./trendyol-sync-button";
import { TrendyolOrderSyncButton } from "./trendyol-order-sync-button";
import { TrendyolDataHelper } from "./trendyol-data-helper";
import { TrendyolImportWizard } from "./trendyol-import-wizard";
import { Box, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function TrendyolIntegrationPage() {
    const { data: config } = await getTrendyolConfig();
    let options = { providers: [], addresses: [] };
    
    if (config && config.supplierId && config.apiKey && config.apiSecret) {
        const optRes = await getTrendyolCargoAndAddresses();
        if (optRes.success && optRes.data) {
            options = optRes.data;
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-3xl font-bold tracking-tight">Trendyol Entegrasyonu</h1>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                    <TrendyolSettingsForm initialData={config} options={options} />
                </div>

                <div className="space-y-6">
                    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                        <h3 className="font-semibold leading-none tracking-tight mb-4">Bilgilendirme</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Entegrasyonu kullanabilmek için Trendyol Partner panelinden API bilgilerinizi almanız gerekmektedir.
                        </p>
                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 mb-6">
                            <li>Ürün Aktarımı (Otomatik)</li>
                            <li>Stok ve Fiyat Eşitleme (Otomatik)</li>
                            <li>Sipariş Entegrasyonu (Manuel/Otomatik)</li>
                        </ul>

                        <div className="flex flex-col gap-3">
                            <Link href="/admin/integrations/trendyol/products">
                                <Button className="w-full bg-orange-600 hover:bg-orange-700 text-white gap-2 shadow-lg shadow-orange-500/20">
                                    <Box className="w-4 h-4" />
                                    Trendyol Ürünlerini Yönet
                                </Button>
                            </Link>
                            <Link href="/admin/integrations/trendyol/questions">
                                <Button variant="outline" className="w-full gap-2 border-orange-200 text-orange-700 hover:bg-orange-50">
                                    <MessageSquare className="w-4 h-4" />
                                    Müşteri Sorularını Yönet
                                </Button>
                            </Link>
                            <Link href="/admin/integrations/trendyol/batches">
                                <Button variant="outline" className="w-full gap-2 border-orange-200 text-orange-700 hover:bg-orange-50">
                                    <Box className="w-4 h-4" />
                                    İşlem (Batch) Geçmişini İzle
                                </Button>
                            </Link>
                        </div>
                    </div>

                    <TrendyolSyncButton />

                    <TrendyolOrderSyncButton />

                    <TrendyolImportWizard />

                    <TrendyolDataHelper isEnabled={!!config} />
                </div>
            </div>
        </div>
    );
}
