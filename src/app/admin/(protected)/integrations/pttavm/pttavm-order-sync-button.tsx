"use client";

import { useState } from "react";
import { syncOrdersFromPttavm } from "./actions";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export function PttavmOrderSyncButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSync = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await syncOrdersFromPttavm();
      setResult(res);
    } catch (err: any) {
      setResult({ success: false, message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-4">
      <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2 text-teal-700">
        <ShoppingBag className="w-4 h-4 text-teal-600" />
        ePttAVM Sipariş Senkronizasyonu
      </h3>
      <p className="text-sm text-muted-foreground">
        ePttAVM'deki son 30 güne ait aktif siparişlerinizi manuel olarak çekip yerel veritabanınıza aktarabilirsiniz.
      </p>

      <Button
        onClick={handleSync}
        disabled={loading}
        className="w-full bg-[#00A896] hover:bg-[#00897B] text-white gap-2 shadow-md"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Siparişler Çekiliyor...
          </>
        ) : (
          <>
            <ShoppingBag className="w-4 h-4" />
            ePttAVM Siparişlerini Şimdi Çek
          </>
        )}
      </Button>

      {result && (
        <div
          className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
            result.success
              ? "bg-green-50 text-green-700 dark:bg-green-950/40 border border-green-200"
              : "bg-red-50 text-red-700 dark:bg-red-950/40 border border-red-200"
          }`}
        >
          {result.success ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{result.message}</span>
        </div>
      )}
    </div>
  );
}
