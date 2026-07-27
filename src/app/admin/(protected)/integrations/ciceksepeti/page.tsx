import { getCiceksepetiConfig } from "./actions";
import { CiceksepetiSettingsForm } from "./ciceksepeti-settings-form";
import { CiceksepetiSyncButton } from "./ciceksepeti-sync-button";
import { Box, ExternalLink, Store, ShoppingCart, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function CiceksepetiIntegrationPage() {
  const config = await getCiceksepetiConfig();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center text-2xl shadow-sm border border-rose-200">
            🌸
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-rose-700 dark:text-rose-400">
              Çiçeksepeti Entegrasyonu
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Çiçeksepeti Marketplace API (ciceksepeti.dev) ile ürün, stok/fiyat ve sipariş yönetimi
            </p>
          </div>
        </div>

        <a
          href="https://bayi.ciceksepeti.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button
            variant="outline"
            size="sm"
            className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 gap-1.5"
          >
            <ExternalLink className="w-4 h-4" />
            Çiçeksepeti Satıcı Paneli
          </Button>
        </a>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <CiceksepetiSettingsForm initialData={config} />
        </div>

        <div className="space-y-6">
          {/* Bilgilendirme ve Hızlı İşlemler Kartı */}
          <div className="rounded-xl border bg-card shadow-sm p-6 space-y-4">
            <h3 className="font-semibold text-base flex items-center gap-2 text-rose-700 dark:text-rose-400">
              <Store className="w-5 h-5 text-rose-600" />
              Çiçeksepeti Entegrasyon Süreçleri
            </h3>

            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2">
              <li>
                <strong>API Yetkilendirme:</strong> Satıcı panelinden edindiğiniz <code className="text-xs bg-rose-50 text-rose-700 px-1 rounded font-mono">x-api-key</code> ile iletişim kurulur.
              </li>
              <li>
                <strong>Test/Sandbox Ortamı:</strong> Test modu aktifken ürün ve fiyat güncellemeleri <code className="text-xs">sandbox-apis.ciceksepeti.com</code> sunucularında denenir.
              </li>
              <li>
                <strong>Fiyat ve Stok Senkronizasyonu:</strong> Kâr marjınız otomatik hesaplanıp Çiçeksepeti stok kodlarına iletilir.
              </li>
              <li>
                <strong>Kritik Stok Takibi:</strong> Sipariş veya stok düşüşlerinde ürün anında Çiçeksepeti'de satışa kapatılır.
              </li>
            </ul>

            <div className="pt-2 space-y-3">
              <Link href="/admin/integrations/ciceksepeti/products" className="block">
                <Button className="w-full bg-rose-600 hover:bg-rose-700 text-white gap-2 shadow-md shadow-rose-500/20">
                  <Box className="w-4 h-4" />
                  Çiçeksepeti Ürün Listesi ve Senkronizasyonu
                </Button>
              </Link>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <CiceksepetiSyncButton mode="prices" variant="outline" />
                <CiceksepetiSyncButton mode="orders" variant="outline" />
              </div>
            </div>
          </div>

          {/* Durum Kartı */}
          {config && (
            <div className="rounded-xl border bg-card shadow-sm p-6">
              <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                Mevcut Entegrasyon Durumu
              </h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Aktiflik Durumu:</span>
                  <span
                    className={`font-semibold px-2.5 py-0.5 rounded-full text-xs ${
                      config.isActive
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                  >
                    {config.isActive ? "Aktif" : "Pasif"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Çalışma Ortamı:</span>
                  <span
                    className={`font-semibold px-2.5 py-0.5 rounded-full text-xs ${
                      config.isTestMode
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                    }`}
                  >
                    {config.isTestMode ? "Test (Sandbox)" : "Canlı (Production)"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Ek Kâr Marjı:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    %{config.profitMargin || 0}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
