
"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { saveHepsiburadaConfig } from "./actions";
import { toast } from "sonner";
import { useEffect } from "react";

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

export function HepsiburadaSettingsForm({ initialData }: Props) {
    const [state, action] = useActionState(saveHepsiburadaConfig, { success: false, message: "" });

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
                    Hepsiburada entegrasyonu için Merchant ID ve şifrenizi girin.
                </CardDescription>
            </CardHeader>
            <CardContent key={initialData?.updatedAt}>
                <form action={action} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="username">Merchant ID (Mağaza ID)</Label>
                        <Input
                            id="username"
                            name="username"
                            defaultValue={initialData?.username}
                            placeholder="f4d3caf2-..."
                            required
                        />
                        <p className="text-[10px] text-muted-foreground">Hepsiburada portalında görünen Mağaza ID değerini buraya yazın.</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Servis Anahtarı (API Key)</Label>
                        <Input
                            id="password"
                            name="password"
                            type="password"
                            defaultValue={initialData?.password}
                            placeholder="API Servis Anahtarı"
                            required
                        />
                        <p className="text-[10px] text-muted-foreground">Entegrasyon sayfasından aldığınız Servis Anahtarını buraya yapıştırın.</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="merchantId">Ek Mağaza ID (Opsiyonel)</Label>
                        <Input
                            id="merchantId"
                            name="merchantId"
                            defaultValue={initialData?.merchantId}
                            placeholder="Genellikle boş bırakılır"
                        />
                    </div>

                    <div className="flex items-center space-x-2 pt-2">
                        <Switch
                            id="isActive"
                            name="isActive"
                            defaultChecked={initialData?.isActive}
                        />
                        <Label htmlFor="isActive">Hepsiburada Entegrasyonunu Aktifleştir</Label>
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

import { testHepsiburadaConnection } from "./actions";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useState } from "react";

function TestConnectionButton() {
    const [loading, setLoading] = useState(false);

    const handleTest = async () => {
        setLoading(true);
        try {
            const res = await testHepsiburadaConnection();
            if (res.success) {
                toast.success(res.message, { icon: <CheckCircle2 className="w-5 h-5 text-green-500" /> });
            } else {
                toast.error(res.message, { icon: <AlertCircle className="w-5 h-5 text-red-500" /> });
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
            className="w-full border-blue-200 text-blue-700 hover:bg-blue-50"
        >
            {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
                "Bağlantıyı Test Et"
            )}
        </Button>
    );
}
