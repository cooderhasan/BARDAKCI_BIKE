"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { syncProductsToCiceksepeti, syncCiceksepetiOrders } from "./actions";
import { toast } from "sonner";
import { RefreshCw, ShoppingCart, Send } from "lucide-react";

interface Props {
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
  mode?: "products" | "prices" | "orders";
}

export function CiceksepetiSyncButton({
  variant = "default",
  size = "default",
  mode = "products",
}: Props) {
  const [loading, setLoading] = useState(false);

  async function handleSync() {
    setLoading(true);

    try {
      if (mode === "orders") {
        const res = await syncCiceksepetiOrders();
        if (res.success) {
          toast.success(res.message);
        } else {
          toast.error(res.error);
        }
      } else if (mode === "prices") {
        const res = await syncProductsToCiceksepeti(undefined, "prices");
        if (res.success) {
          toast.success(res.message);
        } else {
          toast.error(res.error);
        }
      } else {
        const res = await syncProductsToCiceksepeti(undefined, "all");
        if (res.success) {
          toast.success(res.message);
        } else {
          toast.error(res.error);
        }
      }
    } catch (e: any) {
      toast.error(e.message || "İşlem sırasında bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  const getIcon = () => {
    if (mode === "orders") return <ShoppingCart className={`mr-2 h-4 w-4 ${loading ? "animate-bounce" : ""}`} />;
    if (mode === "prices") return <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />;
    return <Send className={`mr-2 h-4 w-4 ${loading ? "animate-pulse" : ""}`} />;
  };

  const getLabel = () => {
    if (mode === "orders") return loading ? "Siparişler Çekiliyor..." : "Siparişleri Çek";
    if (mode === "prices") return loading ? "Fiyat/Stok Aktarılıyor..." : "Stok ve Fiyatları Güncelle";
    return loading ? "Ürünler Gönderiliyor..." : "Tüm Ürünleri Çiçeksepeti'ye Aktar";
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleSync}
      disabled={loading}
      className={mode === "products" ? "bg-rose-600 hover:bg-rose-700 text-white" : ""}
    >
      {getIcon()}
      {getLabel()}
    </Button>
  );
}
