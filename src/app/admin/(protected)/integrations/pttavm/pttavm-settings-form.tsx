"use client";

import { useActionState, useState } from "react";
import { savePttavmConfig, testPttavmConnection } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, CheckCircle2, XCircle, Key, Percent } from "lucide-react";

interface PttavmSettingsFormProps {
  initialData?: any;
}

export function PttavmSettingsForm({ initialData }: PttavmSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(savePttavmConfig, null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testPttavmConnection();
      setTestResult(res);
    } catch (error: any) {
      setTestResult({ success: false, message: error.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="p-6 border-b border-border">
        <h2 className="text-xl font-semibold flex items-center gap-2 text-[#00A896]">
          <Key className="w-5 h-5" />
          ePttAVM API Ayarları
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          ePttAVM Satıcı Portalı REST API v1 kimlik bilgilerinizi giriniz.
        </p>
      </div>

      <form action={formAction} className="p-6 space-y-4">
        {state && (
          <div
            className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
              state.success
                ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400 border border-green-200"
                : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200"
            }`}
          >
            {state.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{state.message}</span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="apiKey">API Key / Kullanıcı Adı (User Name)</Label>
          <Input
            id="apiKey"
            name="apiKey"
            type="text"
            defaultValue={initialData?.apiKey || ""}
            placeholder="Örn: motovitrin veya API Key"
            required
          />
          <p className="text-xs text-muted-foreground">
            ePttAVM REST API Key bilginiz veya Entegra panelindeki <strong>User Name</strong> (Örn: <code>motovitrin</code>).
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="accessToken">Access Token / API Şifresi</Label>
          <Input
            id="accessToken"
            name="accessToken"
            type="text"
            autoComplete="off"
            spellCheck={false}
            defaultValue={initialData?.accessToken || ""}
            placeholder="ePttAVM Access Token kodunu giriniz"
            required
          />
          <p className="text-xs text-muted-foreground">
            ePttAVM Satıcı Portalı'ndan (Self Entegratör sekmesinden) aldığınız uzun Access Token kodu.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="profitMargin" className="flex items-center gap-1.5">
            <Percent className="w-4 h-4 text-teal-600" />
            ePttAVM Kâr Marjı (%)
          </Label>
          <Input
            id="profitMargin"
            name="profitMargin"
            type="number"
            step="0.1"
            defaultValue={initialData?.profitMargin ?? 0}
            placeholder="Örn: 10"
          />
          <p className="text-xs text-muted-foreground">
            ePttAVM'ye aktarılacak tüm ürün fiyatlarına otomatik eklenecek kâr yüzdesi.
          </p>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="space-y-0.5">
            <Label htmlFor="isActive">Entegrasyonu Aktifleştir</Label>
            <p className="text-xs text-muted-foreground">
              Pasif yapıldığında ePttAVM stok/fiyat senkronizasyonu durur.
            </p>
          </div>
          <Switch
            id="isActive"
            name="isActive"
            defaultChecked={initialData?.isActive ?? false}
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="space-y-0.5">
            <Label htmlFor="isTestMode">Test Modu (Sandbox)</Label>
            <p className="text-xs text-muted-foreground">
              Test ortamı aktif ise canlı PttAVM sunucularına işlem iletilmez.
            </p>
          </div>
          <Switch
            id="isTestMode"
            name="isTestMode"
            defaultChecked={initialData?.isTestMode ?? false}
          />
        </div>

        <div className="pt-4 flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            disabled={isPending}
            className="bg-[#00A896] hover:bg-[#00897B] text-white"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              "Ayarları Kaydet"
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleTest}
            disabled={testing}
            className="border-teal-200 text-teal-700 hover:bg-teal-50"
          >
            {testing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Test Ediliyor...
              </>
            ) : (
              "Bağlantıyı Test Et"
            )}
          </Button>
        </div>

        {testResult && (
          <div
            className={`p-3 rounded-lg text-sm flex items-center gap-2 mt-3 ${
              testResult.success
                ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400 border border-green-200"
                : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200"
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}
      </form>
    </div>
  );
}
