
"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { saveN11Config } from "./actions";
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

export function N11SettingsForm({ initialData }: Props) {
    const [state, action] = useActionState(saveN11Config, { success: false, message: "" });

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
                    N11 entegrasyonu için API anahtarlarınızı girin.
                </CardDescription>
            </CardHeader>
            <CardContent key={initialData?.updatedAt}>
                <form action={action} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="apiKey">App Key (API Anahtarı)</Label>
                        <Input
                            id="apiKey"
                            name="apiKey"
                            defaultValue={initialData?.apiKey}
                            placeholder="N11 App Key"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="apiSecret">App Secret (API Şifresi)</Label>
                        <Input
                            id="apiSecret"
                            name="apiSecret"
                            type="password"
                            defaultValue={initialData?.apiSecret}
                            placeholder="N11 App Secret"
                            required
                        />
                    </div>

                    <div className="flex items-center space-x-2 pt-2">
                        <Switch
                            id="isActive"
                            name="isActive"
                            defaultChecked={initialData?.isActive}
                        />
                        <Label htmlFor="isActive">N11 Entegrasyonunu Aktifleştir</Label>
                    </div>

                    <SubmitButton />
                </form>
            </CardContent>
        </Card>
    );
}
