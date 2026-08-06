"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { saveNesConfig, testNesConnection } from "./actions";
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

export function NesSettingsForm({ initialData }: Props) {
    const [state, action] = useActionState(saveNesConfig, { success: false, message: "" });
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
            const res = await testNesConnection();
            if (res.success) {
                toast.success(res.message);
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
        <Card className="border-t-4 border-t-blue-600 shadow-lg">
            <CardHeader>
                <CardTitle className="text-2xl">NES E-Fatura / E-Arşiv Ayarları</CardTitle>
                <CardDescription>
                    NES Bilgi API entegrasyonu için API anahtarınızı ve firma gönderici bilgilerinizi girin.
                </CardDescription>
            </CardHeader>
            <CardContent key={initialData?.updatedAt}>
                <form action={action} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="apiKey">NES API Anahtarı (API Key)</Label>
                        <Input
                            id="apiKey"
                            name="apiKey"
                            type="password"
                            defaultValue={initialData?.apiKey}
                            placeholder="NES Portal'dan alınan Bearer Token / API Key"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="senderVkn">Gönderici VKN / TCKN</Label>
                            <Input
                                id="senderVkn"
                                name="senderVkn"
                                defaultValue={initialData?.senderVkn}
                                placeholder="10 haneli VKN veya 11 haneli TCKN"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="senderAlias">Gönderici Etiketi (Sender Alias)</Label>
                            <Input
                                id="senderAlias"
                                name="senderAlias"
                                defaultValue={initialData?.senderAlias || "urn:mail:defaultgb@nes.com.tr"}
                                placeholder="Örn: urn:mail:defaultgb@nes.com.tr"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="senderTitle">Firma Unvanı</Label>
                        <Input
                            id="senderTitle"
                            name="senderTitle"
                            defaultValue={initialData?.senderTitle}
                            placeholder="Örn: BARDAKCI BIKE PAZARLAMA LTD. ŞTİ."
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="senderAddress">Firma Adresi</Label>
                        <Input
                            id="senderAddress"
                            name="senderAddress"
                            defaultValue={initialData?.senderAddress}
                            placeholder="Açık adres bilgisi"
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="senderCity">İl</Label>
                            <Input
                                id="senderCity"
                                name="senderCity"
                                defaultValue={initialData?.senderCity || "İSTANBUL"}
                                placeholder="İSTANBUL"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="senderDistrict">İlçe</Label>
                            <Input
                                id="senderDistrict"
                                name="senderDistrict"
                                defaultValue={initialData?.senderDistrict}
                                placeholder="MERKEZ"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="taxOffice">Vergi Dairesi</Label>
                            <Input
                                id="taxOffice"
                                name="taxOffice"
                                defaultValue={initialData?.taxOffice}
                                placeholder="Vergi Dairesi Adı"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="defaultProfile">Varsayılan E-Fatura Senaryosu (Profil)</Label>
                        <select
                            id="defaultProfile"
                            name="defaultProfile"
                            defaultValue={initialData?.defaultProfile || "TEMELFATURA"}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <option value="TEMELFATURA">TEMELFATURA (Temel Fatura - Doğrudan Onaylanır)</option>
                            <option value="TICARIFATURA">TICARIFATURA (Ticari Fatura - Alıcı 8 Gün İçinde Reddedebilir)</option>
                        </select>
                        <p className="text-xs text-muted-foreground">E-ticaret ve hızlı teslimat siparişleri için genelde <strong>TEMELFATURA</strong> tercih edilir.</p>
                    </div>

                    <div className="flex flex-col gap-4 p-4 bg-muted/30 rounded-lg border border-dashed">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="isActive">Entegrasyon Durumu</Label>
                                <p className="text-xs text-muted-foreground">Siparişlerde NES ile fatura kesme aktifleşir</p>
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
                                <p className="text-xs text-muted-foreground">İstekler apitest.nes.com.tr adresine gider</p>
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
