
"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
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
import { saveIdefixConfig, testIdefixConnection } from "./actions";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Kaydediliyor..." : "Kaydet"}
    </Button>
  );
}

interface Props {
  initialData?: any;
}

export function IdefixSettingsForm({ initialData }: Props) {
  const [state, action] = useActionState(saveIdefixConfig, {
    success: false,
    message: "",
  });

  useEffect(() => {
    if (state.message) {
      if (state.success) toast.success(state.message);
      else toast.error(state.message);
    }
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Ayarları</CardTitle>
        <CardDescription>
          Idefix Satıcı Paneli → Hesap Bilgilerim → Entegrasyon Bilgileri →
          Yeni API Oluştur ile aldığınız bilgileri girin.
        </CardDescription>
      </CardHeader>
      <CardContent key={initialData?.updatedAt}>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API KEY</Label>
            <Input
              id="apiKey"
              name="apiKey"
              defaultValue={initialData?.apiKey}
              placeholder="8ce68391-d7b3-4e24-9842-..."
              required
            />
            <p className="text-[10px] text-muted-foreground">
              Satıcı panelinden e-postanıza gelen API KEY değerini buraya girin.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiSecret">API SECRET KEY</Label>
            <Input
              id="apiSecret"
              name="apiSecret"
              type="password"
              defaultValue={initialData?.apiSecret}
              placeholder="16ae16os-d82e-4fa4-aace-..."
              required
            />
            <p className="text-[10px] text-muted-foreground">
              API KEY ile birlikte gelen gizli anahtar.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendorId">Satıcı ID (Vendor ID)</Label>
            <Input
              id="vendorId"
              name="vendorId"
              defaultValue={initialData?.vendorId}
              placeholder="12345"
              required
            />
            <p className="text-[10px] text-muted-foreground">
              Sipariş API'sinde URL'de kullanılan satıcı tanımlayıcısı.
            </p>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Switch
              id="isActive"
              name="isActive"
              defaultChecked={initialData?.isActive}
            />
            <Label htmlFor="isActive">Idefix Entegrasyonunu Aktifleştir</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isTestMode"
              name="isTestMode"
              defaultChecked={initialData?.isTestMode ?? true}
            />
            <div className="space-y-0.5">
              <Label htmlFor="isTestMode">Test Modu (Stage Ortamı)</Label>
              <p className="text-[10px] text-muted-foreground">
                Açıkken test sunucularına (idefiks.net) bağlanır, kapatınca
                canlı ortama (idefix.com) geçer.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SubmitButton />
            <TestConnectionButton />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function TestConnectionButton() {
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    setLoading(true);
    try {
      const res = await testIdefixConnection();
      if (res.success) {
        toast.success(res.message, {
          icon: <CheckCircle2 className="w-5 h-5 text-green-500" />,
        });
      } else {
        toast.error(res.message, {
          icon: <AlertCircle className="w-5 h-5 text-red-500" />,
        });
      }
    } catch (error) {
      toast.error("Bağlantı testi sırasında bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleTest}
      disabled={loading}
      className="w-full border-purple-200 text-purple-700 hover:bg-purple-50"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        "Bağlantıyı Test Et"
      )}
    </Button>
  );
}
