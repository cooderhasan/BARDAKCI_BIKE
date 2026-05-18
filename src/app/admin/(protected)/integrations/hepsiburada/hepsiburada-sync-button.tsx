
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { enqueueHepsiburadaSync } from "./actions";

export function HepsiburadaSyncButton() {
    const [loading, setLoading] = useState(false);

    const handleSync = async () => {
        setLoading(true);
        try {
            const res = await enqueueHepsiburadaSync();
            if (res.success) {
                toast.success(res.message);
            } else {
                toast.error(res.message);
            }
        } catch (error) {
            toast.error("Bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
            <h3 className="font-semibold leading-none tracking-tight mb-4">Ürün Eşitleme</h3>
            <p className="text-sm text-muted-foreground mb-4">
                Sistemdeki ürünleri Hepsiburada mağazanıza gönderin veya fiyat/stok güncelleyin.
            </p>
            <div className="space-y-4">
                <Button onClick={handleSync} disabled={loading} className="w-full bg-orange-600 hover:bg-orange-700 text-white">
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            İşleniyor...
                        </>
                    ) : (
                        <>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Ürünleri Hepsiburada'ya Gönder
                        </>
                    )}
                </Button>
                <HBOrderSyncButton />
            </div>
        </div>
    );
}

import { syncOrdersFromHepsiburada } from "./actions";
import { Download } from "lucide-react";

function HBOrderSyncButton() {
    const [loading, setLoading] = useState(false);
    const [orderNumber, setOrderNumber] = useState("");

    const handleOrderSync = async () => {
        setLoading(true);
        try {
            const res = await syncOrdersFromHepsiburada(orderNumber ? orderNumber.trim() : undefined);
            if (res.success) {
                toast.success(res.message);
                if (orderNumber) setOrderNumber("");
            } else {
                toast.error(res.message);
            }
        } catch (error) {
            toast.error("Bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-3 pt-4 border-t border-dashed border-orange-100">
            <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-orange-700">Nokta Atışı Sipariş Çek (Opsiyonel)</label>
                <input
                    type="text"
                    placeholder="Örn: 4623285863"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    disabled={loading}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 border-orange-200 focus-visible:ring-orange-500"
                />
            </div>
            <Button onClick={handleOrderSync} disabled={loading} variant="outline" className="w-full border-orange-200 text-orange-700 hover:bg-orange-50 shadow-sm transition-all duration-200">
                {loading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Siparişler Çekiliyor...
                    </>
                ) : (
                    <>
                        <Download className="mr-2 h-4 w-4" />
                        {orderNumber ? "Bu Siparişi Hepsiburada'dan Çek" : "Siparişleri Hepsiburada'dan Çek"}
                    </>
                )}
            </Button>
        </div>
    );
}
