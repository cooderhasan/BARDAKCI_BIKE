
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { enqueueN11Sync } from "./actions";

export function N11SyncButton() {
    const [loading, setLoading] = useState(false);

    const handleSync = async () => {
        setLoading(true);
        try {
            const res = await enqueueN11Sync();
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
                Sistemdeki ürünleri N11 mağazanıza gönderin veya fiyat/stok güncelleyin.
            </p>
            <div className="space-y-4">
                <Button onClick={handleSync} disabled={loading} className="w-full">
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            İşleniyor...
                        </>
                    ) : (
                        <>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Ürünleri N11'e Gönder
                        </>
                    )}
                </Button>
                <N11AutoMatchButton />
                <N11OrderSyncButton />
            </div>
        </div>
    );
}

import { syncOrdersFromN11, autoMatchN11ProductsAction } from "./actions";
import { Download, Link2 } from "lucide-react";

function N11AutoMatchButton() {
    const [loading, setLoading] = useState(false);

    const handleAutoMatch = async () => {
        if (!confirm("N11 mağazanızdaki tüm ürünler taranıp sitenizdeki ürünlerle (harf büyüklüğü ve eki fark etmeksizin) otomatik eşleştirilecektir. Başlatmak istiyor musunuz?")) return;
        setLoading(true);
        try {
            const res = await autoMatchN11ProductsAction();
            if (res.success) {
                toast.success(res.message);
                window.location.reload();
            } else {
                toast.error(res.message || "Eşleştirme başarısız.");
            }
        } catch (error: any) {
            toast.error("Bir hata oluştu: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button onClick={handleAutoMatch} disabled={loading} variant="secondary" className="w-full bg-purple-100 hover:bg-purple-200 text-purple-900 font-medium">
            {loading ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Mağaza Ürünleri Eşleştiriliyor...
                </>
            ) : (
                <>
                    <Link2 className="mr-2 h-4 w-4 text-purple-700" />
                    N11 Mağaza Kodlarını Otomatik Eşleştir (8.000 Ürün)
                </>
            )}
        </Button>
    );
}

function N11OrderSyncButton() {
    const [loading, setLoading] = useState(false);

    const handleOrderSync = async () => {
        setLoading(true);
        try {
            const res = await syncOrdersFromN11();
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
        <Button onClick={handleOrderSync} disabled={loading} variant="outline" className="w-full">
            {loading ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Siparişler Çekiliyor...
                </>
            ) : (
                <>
                    <Download className="mr-2 h-4 w-4" />
                    Siparişleri N11'den Çek
                </>
            )}
        </Button>
    );
}
