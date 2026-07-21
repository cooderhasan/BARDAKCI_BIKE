import { getStoreSettings } from "@/lib/store-helper";
import { StoreSettingsClient } from "./store-settings-client";
import { Store } from "lucide-react";

export default async function StoreSettingsPage() {
  const [bikeSettings, motorSettings] = await Promise.all([
    getStoreSettings("BIKE"),
    getStoreSettings("MOTOR"),
  ]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600">
            <Store className="h-6 w-6" />
          </div>
          Mağaza Genel Ayarları
        </h1>
        <p className="text-muted-foreground mt-2">
          Bardakçı Bisiklet ve Motovitrin e-ticaret sitelerinizin logo, iletişim, renk ve analitik ayarlarını bağımsız olarak yapılandırın.
        </p>
      </div>

      <StoreSettingsClient bikeSettings={bikeSettings} motorSettings={motorSettings} />
    </div>
  );
}
