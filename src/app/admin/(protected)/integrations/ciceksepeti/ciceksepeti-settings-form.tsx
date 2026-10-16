"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { saveCiceksepetiConfig, testCiceksepetiConnection } from "./actions";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, Loader2, Building2 } from "lucide-react";

interface Props {
  initialData?: any;
}

export function CiceksepetiSettingsForm({ initialData }: Props) {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [isActive, setIsActive] = useState(initialData?.isActive ?? false);
  const [isTestMode, setIsTestMode] = useState(initialData?.isTestMode ?? true);

  const initialOperatorContacts = initialData?.operatorContacts || [];
  const contactsMap: Record<number, { name: string; email: string; address: string }> = {
    1: { name: "", email: "", address: "" },
    2: { name: "", email: "", address: "" },
    3: { name: "", email: "", address: "" },
    4: { name: "", email: "", address: "" },
  };

  if (Array.isArray(initialOperatorContacts)) {
    initialOperatorContacts.forEach((oc: any) => {
      if (oc.type) {
        contactsMap[oc.type] = {
          name: oc.name || "",
          email: oc.email || "",
          address: oc.address || "",
        };
      }
    });
  }

  const [operatorContacts, setOperatorContacts] = useState(contactsMap);

  function updateOperatorContact(type: number, field: "name" | "email" | "address", val: string) {
    setOperatorContacts((prev) => ({
      ...prev,
      [type]: {
        ...(prev as any)[type],
        [field]: val,
      },
    }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setTestResult(null);

    const formData = new FormData(e.currentTarget);
    formData.set("isActive", String(isActive));
    formData.set("isTestMode", String(isTestMode));

    const formattedContacts: any[] = [];
    [1, 2, 3, 4].forEach((type) => {
      const oc = (operatorContacts as any)[type];
      if (oc?.name?.trim() && oc?.address?.trim() && oc?.email?.trim()) {
        formattedContacts.push({
          type,
          name: oc.name.trim(),
          address: oc.address.trim(),
          email: oc.email.trim(),
        });
      }
    });

    if (formattedContacts.length > 0) {
      formData.set("operatorContacts", JSON.stringify(formattedContacts));
    } else {
      formData.set("operatorContacts", "");
    }

    const res = await saveCiceksepetiConfig(formData);
    setLoading(false);

    if (res.success) {
      toast.success(res.message);
    } else {
      toast.error(res.error);
    }
  }

  const [apiKeyInput, setApiKeyInput] = useState(initialData?.apiKey || "");
  const [supplierIdInput, setSupplierIdInput] = useState(initialData?.supplierId || "");

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);

    const res = await testCiceksepetiConnection({
      apiKey: apiKeyInput,
      supplierId: supplierIdInput,
      isTestMode,
    });
    setTesting(false);
    setTestResult(res);

    if (res.success) {
      toast.success(res.message);
    } else {
      toast.error(res.message);
    }
  }

  return (
    <Card className="border-rose-100 dark:border-rose-950">
      <CardHeader className="bg-gradient-to-r from-rose-50/50 to-pink-50/30 dark:from-rose-950/20 dark:to-pink-950/10">
        <CardTitle className="text-rose-700 dark:text-rose-400">Çiçeksepeti API Ayarları</CardTitle>
        <CardDescription>
          Çiçeksepeti Satıcı Paneli (<code className="text-xs bg-rose-100 text-rose-800 px-1 rounded">bayi.ciceksepeti.com</code>) &gt; Mağaza Yönetimi &gt; API Erişim sekmesinden alacağınız API Key bilgilerinizi girin.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="apiKey" className="font-medium">API KEY (x-api-key)</Label>
            <Input
              id="apiKey"
              name="apiKey"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="e.g. cs_live_9a87f6e5d4..."
              required
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Çiçeksepeti API servislerine yetkili erişim için verilen gizli x-api-key anahtarı.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplierId" className="font-medium">Tedarikçi / Mağaza ID (Opsiyonel)</Label>
            <Input
              id="supplierId"
              name="supplierId"
              value={supplierIdInput}
              onChange={(e) => setSupplierIdInput(e.target.value)}
              placeholder="e.g. 102938"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Çiçeksepeti satıcı kodunuz veya mağaza kimlik numaranız.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profitMargin" className="font-medium">Çiçeksepeti Ek Kâr Marjı (%)</Label>
            <Input
              id="profitMargin"
              name="profitMargin"
              type="number"
              step="0.1"
              defaultValue={initialData?.profitMargin ?? 0}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Ürün Çiçeksepeti'ye aktarılırken ürün fiyatına uygulanacak ek kâr marjı yüzdesi.
            </p>
          </div>

          {/* İmalatçı / ithalatçı bilgileri artık Markalar sayfasında markaya göre tanımlanıyor (tüm pazaryerlerinde ortak).
              Eski varsayılan değer silinmedi: sadece zaten Çiçeksepeti'nde olan ilanlar güncellenirken kullanılıyor. */}
          <p className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-xs text-blue-800">
            İmalatçı / ithalatçı bilgileri artık <a href="/admin/brands" className="font-semibold underline">Markalar</a> sayfasında
            markaya göre tanımlanıyor; Çiçeksepeti dahil tüm pazaryerlerine ürün gönderirken oradan dolar.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-rose-50/30 dark:bg-rose-950/10">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">Test Modu (Sandbox)</Label>
                <p className="text-xs text-muted-foreground">
                  Açıkken istekler <code className="text-[10px]">sandbox-apis.ciceksepeti.com</code> adresine iletilir.
                </p>
              </div>
              <Switch checked={isTestMode} onCheckedChange={setIsTestMode} />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-emerald-50/30 dark:bg-emerald-950/10">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  Entegrasyon Aktif
                </Label>
                <p className="text-xs text-muted-foreground">
                  Çiçeksepeti stok ve fiyat senkronizasyonunu aktifleştirir.
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          {testResult && (
            <div
              className={`p-3.5 rounded-lg flex items-center gap-3 text-sm ${
                testResult.success
                  ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                  : "bg-red-50 text-red-900 border border-red-200"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || loading}
              className="sm:w-1/2 border-rose-200 text-rose-700 hover:bg-rose-50"
            >
              {testing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Bağlantı Test Ediliyor...
                </>
              ) : (
                "Bağlantıyı Test Et"
              )}
            </Button>

            <Button
              type="submit"
              disabled={loading || testing}
              className="sm:w-1/2 bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                "Ayarları Kaydet"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
