"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { syncOrdersFromPazarama } from "./actions";
import { useRouter } from "next/navigation";

export function PazaramaOrderSyncButton({ variant = "card" }: { variant?: "card" | "button" }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSync = async () => {
    setLoading(true);
    try {
      const res = await syncOrdersFromPazarama();
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } catch (error: any) {
      toast.error(error.message || "Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  if (variant === "button") {
    return (
      <Button
        onClick={handleSync}
        disabled={loading}
        variant="outline"
        className="border-pink-200 text-pink-700 hover:bg-pink-50 gap-2 shrink-0"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Siparişler Çekiliyor..." : "Pazarama Siparişlerini Çek (Sync)"}
      </Button>
    );
  }

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
      <h3 className="font-semibold leading-none tracking-tight mb-2 text-pink-700 flex items-center gap-2">
        <RefreshCw className="w-4 h-4 text-pink-600" />
        Sipariş Senkronizasyonu
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Pazarama'dan gelen siparişleri çekerek yerel sipariş listenize (/admin/orders) ve veritabanınıza aktarır.
      </p>
      <Button
        onClick={handleSync}
        disabled={loading}
        className="w-full bg-[#D81B60] hover:bg-[#C2185B] text-white gap-2 shadow-sm"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Siparişler Çekiliyor...
          </>
        ) : (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            Siparişleri Şimdi Eşitle (Sync)
          </>
        )}
      </Button>
    </div>
  );
}
