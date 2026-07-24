import { getPazaramaConfig } from "./actions";
import { PazaramaSettingsForm } from "./pazarama-settings-form";
import { PazaramaOrderSyncButton } from "./pazarama-order-sync-button";
import { PazaramaCategoryBrandSyncButton } from "./pazarama-cat-brand-sync-button";
import { Box, ExternalLink, Store, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function PazaramaIntegrationPage() {
  const { data: config } = await getPazaramaConfig();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-100 dark:bg-pink-950/40 flex items-center justify-center text-lg shadow-sm">
            🛍️
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#D81B60]">
              Pazarama Entegrasyonu
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pazarama Marketplace API ile ürün ve stok/fiyat yönetimi
            </p>
          </div>
        </div>
        <a
          href="https://isortagim.pazarama.com/auth/integration"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button
            variant="outline"
            size="sm"
            className="border-pink-200 text-pink-700 hover:bg-pink-50 gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Pazarama Satıcı Portalı
          </Button>
        </a>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <PazaramaSettingsForm initialData={config} />
        </div>

        <div className="space-y-6">
          {/* Bilgilendirme Kartı */}
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-4">
            <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2 text-pink-700">
              <Store className="w-4 h-4 text-pink-600" />
              Pazarama Entegrasyonu Hakkında
            </h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2">
              <li>
                <strong>API Kimlik Doğrulama:</strong> API Key ve API Secret bilgileri Pazarama İş Ortağım panelinden alınır.
              </li>
              <li>
                <strong>Toplu Aktarım (Batch):</strong> Seçilen ürünler görselleri, açıklamaları ve barkodlarıyla Pazarama'ya iletilir.
              </li>
              <li>
                <strong>Stok & Fiyat Senkronizasyonu:</strong> Kâr marjınız eklenerek ürün fiyatları ve stok durumu Pazarama'da güncellenir.
              </li>
              <li>
                <strong>Kargo & Sipariş Yönetimi:</strong> Gelen siparişler yerel sipariş listenizle eşitlenir.
              </li>
            </ul>

            <div className="pt-2 space-y-2">
              <a href="/admin/integrations/pazarama/products">
                <Button className="w-full bg-[#D81B60] hover:bg-[#C2185B] text-white gap-2 shadow-lg shadow-pink-500/20">
                  <Box className="w-4 h-4" />
                  Pazarama Ürünlerini Yönet
                </Button>
              </a>
              <a href="/admin/integrations/pazarama/orders">
                <Button variant="outline" className="w-full border-pink-200 text-pink-700 hover:bg-pink-50 gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  Pazarama Siparişleri
                </Button>
              </a>
            </div>
          </div>

          <PazaramaOrderSyncButton />
          <PazaramaCategoryBrandSyncButton />

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
                    {config.isActive ? "✅ Aktif" : "⚪ Pasif"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Ortam:</span>
                  <span
                    className={`font-medium px-2 py-0.5 rounded-full text-xs ${
                      config.isTestMode
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {config.isTestMode ? "⚠️ Test Modu (Stage)" : "🚀 Canlı Ortam"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Pazarama Kâr Marjı:</span>
                  <span className="font-semibold text-pink-700">
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
