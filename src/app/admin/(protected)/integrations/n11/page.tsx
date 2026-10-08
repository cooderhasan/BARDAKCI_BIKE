
import { getN11Config } from "./actions";
import { N11SettingsForm } from "./n11-settings-form";
import { N11SyncButton } from "./n11-sync-button";
import { Box } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function N11IntegrationPage() {
    const { data: config } = await getN11Config();

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-3xl font-bold tracking-tight">N11 Entegrasyonu</h1>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <div>
                    <N11SettingsForm initialData={config} />
                </div>

                <div className="space-y-6">
                    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                        <h3 className="font-semibold leading-none tracking-tight mb-4">Bilgilendirme</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            N11 API anahtarlarınızı Developer panelinden alabilirsiniz.
                        </p>
                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 mb-6">
                            <li>Ürün Aktarımı (Otomatik)</li>
                            <li>Stok ve Fiyat Eşitleme (Otomatik)</li>
                        </ul>

                        <a href="/admin/integrations/n11/products">
                            <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white gap-2 shadow-lg shadow-purple-500/20">
                                <Box className="w-4 h-4" />
                                N11 Ürünlerini Yönet
                            </Button>
                        </a>
                    </div>

                    <N11SyncButton />
                </div>
            </div>
        </div>
    );
}
