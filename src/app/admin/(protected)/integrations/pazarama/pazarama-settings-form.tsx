"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { savePazaramaConfig, testPazaramaConnection } from "./actions";
import { Loader2, CheckCircle2, XCircle, KeyRound, Store, Percent } from "lucide-react";

interface PazaramaSettingsFormProps {
  initialData?: {
    apiKey?: string;
    apiSecret?: string;
    merchantId?: string;
    profitMargin?: number;
    isActive?: boolean;
    isTestMode?: boolean;
  } | null;
}

export function PazaramaSettingsForm({ initialData }: PazaramaSettingsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [isTesting, setIsTesting] = useState(false);
  const [isActive, setIsActive] = useState(initialData?.isActive ?? false);
  const [isTestMode, setIsTestMode] = useState(initialData?.isTestMode ?? false);

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (isActive) formData.set("isActive", "on");
    if (isTestMode) formData.set("isTestMode", "on");

    startTransition(async () => {
      const res = await savePazaramaConfig(null, formData);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const res = await testPazaramaConnection();
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Bağlantı testi sırasında bir hata oluştu.");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card className="border-pink-200/60 dark:border-pink-900/40 shadow-sm">
      <CardHeader className="bg-pink-50/50 dark:bg-pink-950/20 pb-4">
        <CardTitle className="text-[#D81B60] dark:text-pink-400 flex items-center gap-2 text-xl">
          <Store className="w-5 h-5" />
          Pazarama API Kimlik Bilgileri
        </CardTitle>
        <CardDescription>
          Pazarama İş Ortağım Satıcı Paneli (isortagim.pazarama.com) üzerinden temin ettiğiniz entegrasyon bilgilerini giriniz.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSave} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="apiKey" className="flex items-center gap-1.5 font-medium text-sm">
              <KeyRound className="w-4 h-4 text-pink-600" />
              API Key
            </Label>
            <Input
              id="apiKey"
              name="apiKey"
              type="text"
              defaultValue={initialData?.apiKey || ""}
              placeholder="Pazarama API Key"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiSecret" className="flex items-center gap-1.5 font-medium text-sm">
              <KeyRound className="w-4 h-4 text-pink-600" />
              API Secret
            </Label>
            <Input
              id="apiSecret"
              name="apiSecret"
              type="password"
              defaultValue={initialData?.apiSecret || ""}
              placeholder="Pazarama API Secret Key"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="merchantId" className="flex items-center gap-1.5 font-medium text-sm">
              <Store className="w-4 h-4 text-pink-600" />
              Mağaza / Tedarikçi Kodu (Merchant ID)
            </Label>
            <Input
              id="merchantId"
              name="merchantId"
              type="text"
              defaultValue={initialData?.merchantId || ""}
              placeholder="Örn: M-12345 (Opsiyonel)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profitMargin" className="flex items-center gap-1.5 font-medium text-sm">
              <Percent className="w-4 h-4 text-pink-600" />
              Pazarama Ek Kâr Marjı (%)
            </Label>
            <Input
              id="profitMargin"
              name="profitMargin"
              type="number"
              step="0.01"
              defaultValue={initialData?.profitMargin ?? 0}
              placeholder="Örn: 10 (Sitedeki fiyatın %10 üstüne satmak için)"
            />
            <p className="text-xs text-muted-foreground">
              Ürünler Pazarama'ya aktarılırken site fiyatına eklenecek varsayılan kâr oranını belirleyebilirsiniz.
            </p>
          </div>

          <div className="pt-2 border-t space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="isActive" className="font-semibold cursor-pointer">
                  Entegrasyon Aktiflik Durumu
                </Label>
                <p className="text-xs text-muted-foreground">
                  Pasif ise Pazarama senkronizasyonu durdurulur.
                </p>
              </div>
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="isTestMode" className="font-semibold cursor-pointer">
                  Test Modu (Stage API)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Canlı mağaza anahtarlarınız (isortagim.pazarama.com) için <strong>Kapalı (Canlı Ortam)</strong> olmalıdır.
                </p>
              </div>
              <Switch
                id="isTestMode"
                checked={isTestMode}
                onCheckedChange={setIsTestMode}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <Button
              type="submit"
              disabled={isPending}
              className="bg-[#D81B60] hover:bg-[#C2185B] text-white flex-1"
            >
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Ayarları Kaydet
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="border-pink-200 text-pink-700 hover:bg-pink-50"
            >
              {isTesting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-1.5 text-pink-600" />
              )}
              Bağlantıyı Test Et
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
