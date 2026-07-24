"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw, FolderTree, Tag } from "lucide-react";
import { toast } from "sonner";
import { syncPazaramaCategoriesAndBrandsFromApi } from "./actions";

export function PazaramaCategoryBrandSyncButton() {
  const [loading, setLoading] = useState(false);

  const handleSync = async () => {
    setLoading(true);
    try {
      const res = await syncPazaramaCategoriesAndBrandsFromApi();
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Pazarama verileri çekilirken bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-pink-200/60 dark:border-pink-900/40 shadow-sm bg-gradient-to-br from-pink-50/40 to-white dark:from-pink-950/10 dark:to-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-[#D81B60] text-base flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-pink-600" />
          Pazarama Kategori & Marka Ağacı
        </CardTitle>
        <CardDescription className="text-xs">
          Pazarama API'sinde tanımlı canlı kategori ve marka listesini çekerek sistemdeki eşleştirme seçim listelerinize yükler.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={handleSync}
          disabled={loading}
          variant="outline"
          className="w-full border-pink-300 text-pink-800 hover:bg-pink-100/70 dark:border-pink-800 dark:text-pink-300 dark:hover:bg-pink-900/40 gap-2 font-medium"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-pink-600" />
          ) : (
            <RefreshCw className="w-4 h-4 text-pink-600" />
          )}
          {loading ? "API'den Çekiliyor..." : "Pazarama Kategori ve Markalarını Canlı Çek"}
        </Button>
      </CardContent>
    </Card>
  );
}
