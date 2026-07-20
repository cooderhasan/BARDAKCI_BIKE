
import { getIdefixConfig } from "./actions";
import { IdefixSettingsForm } from "./idefix-settings-form";
import { IdefixSyncButton, IdefixTrackingPanel } from "./idefix-sync-button";
import { Box, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function IdefixIntegrationPage() {
  const { data: config } = await getIdefixConfig();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-lg">
            🛒
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-purple-700">
              Idefix Entegrasyonu
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Idefix Marketplace API ile ürün ve sipariş yönetimi
            </p>
          </div>
        </div>
        <a
          href="https://developer.idefix.com/api"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button
            variant="outline"
            size="sm"
            className="border-purple-200 text-purple-700 hover:bg-purple-50 gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            API Dökümantasyonu
          </Button>
        </a>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <IdefixSettingsForm initialData={config} />
        </div>

        <div className="space-y-6">
          {/* Bilgilendirme Kartı */}
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
            <h3 className="font-semibold leading-none tracking-tight mb-4">
              Idefix API Hakkında
            </h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 mb-6">
              <li>
                <strong>Authentication:</strong> base64(apiKey:secretKey) →
                X-API-KEY header
              </li>
              <li>
                <strong>PIM:</strong> Ürün ekleme, stok/fiyat güncelleme
              </li>
              <li>
                <strong>OMS:</strong> Sipariş yönetimi, kargo bildirimi
              </li>
              <li>Test ortamı için IP yetkilendirmesi gerekir</li>
              <li>Barkodlu varyantlar zorunludur</li>
            </ul>

            <a href="/admin/integrations/idefix/products">
              <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white gap-2 shadow-lg shadow-purple-500/20">
                <Box className="w-4 h-4" />
                Idefix Ürünlerini Yönet
              </Button>
            </a>
          </div>

          {/* Durum Kartı */}
          {config && (
            <div className="rounded-lg border bg-card shadow-sm p-6">
              <h3 className="font-semibold leading-none tracking-tight mb-3">
                Mevcut Durum
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
                        ? "bg-amber-100 text-amber-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {config.isTestMode ? "🧪 Test (Stage)" : "🚀 Canlı (Prod)"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Vendor ID:</span>
                  <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                    {config.vendorId}
                  </span>
                </div>
              </div>
            </div>
          )}

          <IdefixSyncButton />

          <IdefixTrackingPanel />
        </div>
      </div>
    </div>
  );
}
