
import { getHepsiburadaConfig } from "./actions";
import { HepsiburadaSettingsForm } from "./hepsiburada-settings-form";
import { HepsiburadaSyncButton } from "./hepsiburada-sync-button";
import { HepsiburadaTestOrderButton } from "./hepsiburada-test-order-button";
import { Box } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function HepsiburadaIntegrationPage() {
    const { data: config } = await getHepsiburadaConfig();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight text-orange-600">Hepsiburada Entegrasyonu</h1>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <div>
                    <HepsiburadaSettingsForm initialData={config} />
                </div>

                <div className="space-y-6">
                    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                        <h3 className="font-semibold leading-none tracking-tight mb-4">Bilgilendirme</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Hepsiburada Merchant Portal üzerinden API bilgilerinizi alabilirsiniz.
                        </p>
                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 mb-6">
                            <li>Katalog Eşleştirme (Otomatik)</li>
                            <li>Stok ve Fiyat Eşitleme (Anlık)</li>
                        </ul>

                        <a href="/admin/integrations/hepsiburada/products">
                            <Button className="w-full bg-[#17457C] hover:bg-[#0f3460] text-white gap-2 shadow-lg shadow-blue-500/20">
                                <Box className="w-4 h-4" />
                                HB Ürünlerini Yönet
                            </Button>
                        </a>
                    </div>

                    <HepsiburadaSyncButton />

                    {config?.isTestMode && (
                        <HepsiburadaTestOrderButton />
                    )}
                </div>
            </div>
        </div>
    );
}
