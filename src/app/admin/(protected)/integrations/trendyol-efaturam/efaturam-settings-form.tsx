"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { saveEFaturamConfig, testEFaturamConnection } from "./actions";
import { toast } from "sonner";
import { useEffect, useState } from "react";

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Kaydediliyor..." : "Ayarları Kaydet"}
        </Button>
    );
}

interface Props {
    initialData?: any;
}

export function EFaturamSettingsForm({ initialData }: Props) {
    const [state, action] = useActionState(saveEFaturamConfig, { success: false, message: "" });
    const [isTesting, setIsTesting] = useState(false);

    useEffect(() => {
        if (state.message) {
            if (state.success) toast.success(state.message);
            else toast.error(state.message);
        }
    }, [state]);

    const handleTest = async () => {
        setIsTesting(true);
        try {
            const res = await testEFaturamConnection();
            if (res.success) {
                const prefixInfo = res.prefixes && res.prefixes.length > 0 
                    ? `\nKullanılabilir Prefixler: ${res.prefixes.join(", ")}` 
                    : "\nOtomatik prefix bulunamadı.";
                toast.success(res.message + prefixInfo);
            } else {
                toast.error(res.message);
            }
        } catch (error) {
            toast.error("Bağlantı testi sırasında hata oluştu.");
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <Card className="border-t-4 border-t-orange-500 shadow-lg">
            <CardHeader>
                <CardTitle className="text-2xl">Trendyol e-Faturam Ayarları</CardTitle>
                <CardDescription>
                    E-Fatura gönderimi için API giriş bilgilerinizi girin.
                </CardDescription>
            </CardHeader>
            <CardContent key={initialData?.updatedAt}>
                <form action={action} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="username">E-Faturam Kullanıcı Adı</Label>
                        <Input
                            id="username"
                            name="username"
                            defaultValue={initialData?.username}
                            placeholder="Genelde e-posta veya VKN olur"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">E-Faturam Şifre</Label>
                        <Input
                            id="password"
                            name="password"
                            type="password"
                            defaultValue={initialData?.password}
                            placeholder="API Şifresi"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="companyId">Cari ID / Şirket ID (Opsiyonel)</Label>
                        <Input
                            id="companyId"
                            name="companyId"
                            defaultValue={initialData?.companyId}
                            placeholder="Eğer sisteminizde birden fazla cari varsa"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="earchivePrefix">e-Arşiv Ön Ek</Label>
                            <Input
                                id="earchivePrefix"
                                name="earchivePrefix"
                                defaultValue={initialData?.earchivePrefix || "DAP"}
                                placeholder="Örn: DAP veya TYA"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="efaturaPrefix">e-Fatura Ön Ek</Label>
                            <Input
                                id="efaturaPrefix"
                                name="efaturaPrefix"
                                defaultValue={initialData?.efaturaPrefix || "DIP"}
                                placeholder="Örn: DIP veya TYE"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 p-4 bg-muted/30 rounded-lg border border-dashed">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="isActive">Entegrasyon Durumu</Label>
                                <p className="text-xs text-muted-foreground">Siparişlerde buton aktifleşir</p>
                            </div>
                            <Switch
                                id="isActive"
                                name="isActive"
                                defaultChecked={initialData?.isActive}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="isTestMode">Test Modu</Label>
                                <p className="text-xs text-muted-foreground">Fatura gerçek sisteme gitmez</p>
                            </div>
                            <Switch
                                id="isTestMode"
                                name="isTestMode"
                                defaultChecked={initialData?.isTestMode ?? true}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4">
                        <SubmitButton />
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={handleTest}
                            disabled={isTesting}
                        >
                            {isTesting ? "Test Ediliyor..." : "Bağlantıyı Test Et"}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
