"use client";

import { useState } from "react";
import { Bell, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestStockNotification } from "@/app/(storefront)/products/stock-notify-actions";

interface StockNotifyFormProps {
    productId: string;
    variantId?: string | null;
    variantLabel?: string | null;
}

/** Stokta olmayan ürün/seçenek için "Gelince Haber Ver" formu */
export function StockNotifyForm({ productId, variantId, variantLabel }: StockNotifyFormProps) {
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState("");
    const [consent, setConsent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await requestStockNotification({ productId, variantId, email, consent });
            if (res.success) {
                toast.success(res.message);
                setDone(true);
            } else {
                toast.error(res.message);
            }
        } finally {
            setLoading(false);
        }
    };

    if (done) {
        return (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-700 dark:border-green-900/40 dark:bg-green-900/20">
                <Check className="h-4 w-4 shrink-0" />
                Stoğa girdiğinde e-posta ile haber vereceğiz.
            </div>
        );
    }

    if (!open) {
        return (
            <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(true)}
                className="h-12 w-full border-[#17457C]/30 text-base font-bold text-[#17457C] hover:bg-[#17457C]/5"
            >
                <Bell className="mr-2 h-5 w-5" />
                Gelince Haber Ver
            </Button>
        );
    }

    return (
        <form onSubmit={submit} className="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Stoğa girince haber verelim{variantLabel ? ` (${variantLabel})` : ""}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                    type="email"
                    required
                    placeholder="E-posta adresiniz"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 min-w-0 flex-1"
                />
                <Button type="submit" disabled={loading} className="h-11 bg-[#17457C] font-bold text-white hover:bg-[#0f3460]">
                    {loading ? "Kaydediliyor..." : "Haber Ver"}
                </Button>
            </div>
            <label className="flex items-start gap-2 text-xs text-gray-500">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" required />
                <span>Ürün stoğa girdiğinde bilgilendirilmek amacıyla e-posta adresimin kullanılmasını onaylıyorum. Bildirim bir kez gönderilir.</span>
            </label>
        </form>
    );
}
