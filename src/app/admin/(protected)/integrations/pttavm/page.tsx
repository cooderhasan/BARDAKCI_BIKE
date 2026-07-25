import { getPttavmConfig } from "./actions";
import { PttavmSettingsForm } from "./pttavm-settings-form";
import { PttavmOrderSyncButton } from "./pttavm-order-sync-button";
import { ExternalLink, Store, Box } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function PttavmIntegrationPage() {
  const { data: config } = await getPttavmConfig();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950/40 flex items-center justify-center text-lg shadow-sm">
            📮
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#00A896]">
              ePttAVM Entegrasyonu
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              ePttAVM Marketplace REST API v1 ile ürün, stok/fiyat ve sipariş yönetimi
            </p>
          </div>
        </div>
        <a
          href="https://developers.pttavm.com/tr"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button
            variant="outline"
            size="sm"
            className="border-teal-200 text-teal-700 hover:bg-teal-50 gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            ePttAVM Geliştirici Portalı
          </Button>
        </a>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <PttavmSettingsForm initialData={config} />
        </div>

        <div className="space-y-6">
          {/* Bilgilendirme Kartı */}
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-4">
            <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2 text-teal-700">
              <Store className="w-4 h-4 text-teal-600" />
              ePttAVM REST API v1 Hakkında
            </h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2">
              <li>
                <strong>Kimlik Doğrulama:</strong> API Key ve Access Token bilgileri ePttAVM Satıcı Portalı entegrasyon ayarlarından alınır.
              </li>
              <li>
                <strong>Ürün Ekleme / Güncelleme (Upsert):</strong> Ürünleriniz görselleri, açıklamaları ve barkodlarıyla ePttAVM kataloğuna aktarılır.
              </li>
              <li>
                <strong>Hızlı Stok & Fiyat Güncelleme:</strong> Kâr marjınız eklenerek KDV dahil/hariç fiyatlar ve kritik stok filtresinden geçmiş stok adedi aktarılır.
              </li>
              <li>
                <strong>Sipariş Yönetimi:</strong> Gelen ePttAVM siparişleri yerel sipariş listenizle eşleştirilip stoklarınız otomatik eksiltilir.
              </li>
            </ul>

            <div className="pt-2 space-y-2">
              <a href="/admin/integrations/pttavm/products">
                <Button className="w-full bg-[#00A896] hover:bg-[#00897B] text-white gap-2 shadow-lg shadow-teal-500/20">
                  <Box className="w-4 h-4" />
                  ePttAVM Ürünlerini Yönet
                </Button>
              </a>
            </div>
          </div>

          <PttavmOrderSyncButton />

          {/* Durum Kartı */}
          {config && (
            <div className="rounded-lg border bg-card shadow-sm p-6">
              <h3 className="font-semibold leading-none tracking-tight mb-3">
                Mevcut Entegrasyon Durumu
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Durum:</span>
                  <span
                    className={`font-medium px-2 py-0.5 rounded-full text-xs ${
                      config.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {config.isActive ? "Aktif" : "Pasif"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Ortam:</span>
                  <span className="font-medium">
                    {config.isTestMode ? "Test (Sandbox)" : "Canlı (Production)"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Kâr Marjı:</span>
                  <span className="font-medium">%{config.profitMargin || 0}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
