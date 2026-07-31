
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
                <N11ExcelImportButton />
                <N11OrderSyncButton />
            </div>
        </div>
    );
}

import { syncOrdersFromN11, autoMatchN11ProductsAction, importN11ExcelAction, importN11MappingsAction } from "./actions";
import { Download, Link2, FileSpreadsheet } from "lucide-react";

function N11ExcelImportButton() {
    const [loading, setLoading] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            const XLSX = await import("xlsx");
            const reader = new FileReader();
            reader.onload = async (evt) => {
                try {
                    const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                    const wb = XLSX.read(data, { type: "array" });
                    const sheet = wb.Sheets[wb.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(sheet) as any[];

                    if (!rows || rows.length === 0) {
                        toast.error("Excel dosyası boş veya okunamadı.");
                        setLoading(false);
                        return;
                    }

                    const mappings = rows.map((row: any) => ({
                        sku: (row["Urun-Kodu"] || row["Ürün Kodu"] || row["Stok Kodu"] || "").toString().trim(),
                        sellerCode: (row["N11-Entegrasyon-Kodu"] || row["Entegrasyon Kodu"] || row["Magaza Ürün Kodu"] || "").toString().trim(),
                        n11Id: row["N11-ilan-id"] || row["N11 İlan ID"] || row["IlanId"] ? String(row["N11-ilan-id"] || row["N11 İlan ID"] || row["IlanId"]).trim() : null
                    })).filter(item => item.sku && item.sellerCode);

                    if (mappings.length === 0) {
                        toast.error("Excel dosyasında geçerli Stok Kodu ve Entegrasyon Kodu sütunları bulunamadı.");
                        setLoading(false);
                        return;
                    }

                    const res = await importN11MappingsAction(mappings);
                    if (res.success) {
                        toast.success(res.message);
                        window.location.reload();
                    } else {
                        toast.error(res.message || "Eşleştirme başarısız.");
                    }
                } catch (err: any) {
                    toast.error("İşleme hatası: " + err.message);
                } finally {
                    setLoading(false);
                }
            };
            reader.readAsArrayBuffer(file);
        } catch (error: any) {
            toast.error("Hata: " + error.message);
            setLoading(false);
        }
    };

    const handleDirectImport = async () => {
        setLoading(true);
        try {
            const res = await importN11ExcelAction();
            if (res.success) {
                toast.success(res.message);
                window.location.reload();
            } else {
                toast.error(res.message);
            }
        } catch (error: any) {
            toast.error("Hata: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-2">
            <label className="block w-full">
                <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={loading}
                />
                <Button
                    type="button"
                    disabled={loading}
                    variant="outline"
                    className="w-full bg-green-50 hover:bg-green-100 text-green-800 border-green-300 font-medium"
                    onClick={(e) => {
                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                        if (input) input.click();
                    }}
                >
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Excel Eşleştiriliyor...
                        </>
                    ) : (
                        <>
                            <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
                            Entegra Excel'i Yükle & Eşleştir (.xlsx)
                        </>
                    )}
                </Button>
            </label>
        </div>
    );
}

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
