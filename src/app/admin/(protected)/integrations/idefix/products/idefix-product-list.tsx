
"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Search,
  Send,
  RefreshCcw,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import {
  syncProductsToIdefix,
  enqueueIdefixSync,
  toggleIdefixProductActive,
} from "../actions";

interface IdefixProductListProps {
  initialProducts: any[];
}

export function IdefixProductList({ initialProducts }: IdefixProductListProps) {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState(initialProducts);
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const handleBulkSync = async () => {
    setSyncing(true);
    try {
      const res = await enqueueIdefixSync();
      if (res.success) {
        toast.success(res.message, { duration: 5000 });
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Bir hata olustu.");
    } finally {
      setSyncing(false);
    }
  };

  const handleSingleSync = async (productId: string) => {
    setLoadingProductId(productId);
    try {
      const res = await syncProductsToIdefix([productId]);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Bir hata olustu.");
    } finally {
      setLoadingProductId(null);
    }
  };

  const handleToggleActive = async (productId: string, currentValue: boolean) => {
    setToggling(productId);
    try {
      const res = await toggleIdefixProductActive(productId, !currentValue);
      if (res.success) {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === productId ? { ...p, isIdefixActive: !currentValue } : p
          )
        );
        toast.success(!currentValue ? "Idefix icin aktiflestirildi" : "Idefix icin devre disi birakildi");
      } else {
        toast.error("Guncelleme basarisiz");
      }
    } catch {
      toast.error("Bir hata olustu.");
    } finally {
      setToggling(null);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()) ||
      p.brand?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = products.filter((p) => p.isIdefixActive).length;
  const syncedCount = products.filter((p) => p.idefixProduct?.isSynced).length;

  const getSyncStatusBadge = (idefixProduct: any) => {
    if (!idefixProduct) {
      return (
        <Badge variant="outline" className="text-gray-500 border-gray-200 text-xs">
          Gonderilmedi
        </Badge>
      );
    }
    if (idefixProduct.batchStatus === "PENDING") {
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
          <Clock className="w-3 h-3 mr-1" />
          Beklemede
        </Badge>
      );
    }
    if (idefixProduct.isSynced) {
      return (
        <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Senkronize
        </Badge>
      );
    }
    if (idefixProduct.lastSyncError) {
      return (
        <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">
          <AlertCircle className="w-3 h-3 mr-1" />
          Hata
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-gray-500 border-gray-200 text-xs">
        Bekliyor
      </Badge>
    );
  };

  const getBarcodeCount = (product: any) => {
    const variantCount = (product.variants || []).filter((v: any) => v.barcode).length;
    if (variantCount > 0) return variantCount;
    return product.barcode ? 1 : 0;
  };

  const handleSingleSyncWithCheck = async (product: any) => {
    const count = getBarcodeCount(product);
    if (count === 0) {
      toast.error("Ürünün veya varyantlarının barkodu bulunamadı. Lütfen ürün düzenleme sayfasından barkod ekleyin.");
      return;
    }
    await handleSingleSync(product.id);
  };

  return (
    <div className="space-y-4">
      {/* Ozet */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Toplam Urun</p>
          <p className="text-2xl font-bold">{products.length}</p>
        </div>
        <div className="rounded-lg border bg-purple-50 p-4">
          <p className="text-sm text-purple-600">Idefix Aktif</p>
          <p className="text-2xl font-bold text-purple-700">{activeCount}</p>
        </div>
        <div className="rounded-lg border bg-green-50 p-4">
          <p className="text-sm text-green-600">Senkronize</p>
          <p className="text-2xl font-bold text-green-700">{syncedCount}</p>
        </div>
      </div>

      {/* Arama ve Toplu Sync */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Urun adi, SKU veya marka ile ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          onClick={handleBulkSync}
          disabled={syncing}
          className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
        >
          {syncing ? (
            <>
              <RefreshCcw className="w-4 h-4 animate-spin" />
              Senkronize Ediliyor...
            </>
          ) : (
            <>
              <RefreshCcw className="w-4 h-4" />
              Tumunu Sync Et ({activeCount})
            </>
          )}
        </Button>
      </div>

      {/* Tablo */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Urun Adi</TableHead>
              <TableHead>Marka</TableHead>
              <TableHead className="text-center">Barkodlu Var.</TableHead>
              <TableHead className="text-center">Idefix Aktif</TableHead>
              <TableHead className="text-center">Sync Durumu</TableHead>
              <TableHead className="text-right">Fiyat</TableHead>
              <TableHead className="text-center">Islem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Urun bulunamadi.
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => {
                const barcodeCount = getBarcodeCount(product);
                const hasBarcode = barcodeCount > 0;
                const isSending = loadingProductId === product.id;
                const isToggling = toggling === product.id;

                return (
                  <TableRow key={product.id} className={product.isIdefixActive ? "bg-purple-50/30" : ""}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm line-clamp-1">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.sku}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{product.brand?.name ?? "-"}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {hasBarcode ? (
                        <Badge className="bg-green-100 text-green-700 text-xs">
                          {barcodeCount} varyant
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-500 border-red-200 text-xs">
                          Barkod Yok
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={product.isIdefixActive}
                        disabled={isToggling}
                        onCheckedChange={() =>
                          handleToggleActive(product.id, product.isIdefixActive)
                        }
                        className="data-[state=checked]:bg-purple-600"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      {getSyncStatusBadge(product.idefixProduct)}
                      {product.idefixProduct?.lastSyncError && (
                        <p className="text-xs text-red-500 mt-1 max-w-[150px] truncate">
                          {product.idefixProduct.lastSyncError}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="text-sm">
                        <p className="font-medium">
                          ₺{Number(product.idefixPrice ?? product.salePrice ?? product.listPrice).toFixed(2)}
                        </p>
                        {product.idefixPrice && (
                          <p className="text-xs text-purple-600">Idefix Fiyatı</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isSending}
                        onClick={() => handleSingleSyncWithCheck(product)}
                        className="border-purple-200 text-purple-700 hover:bg-purple-50 gap-1.5"
                      >
                        {isSending ? (
                          <RefreshCcw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Send className="w-3 h-3" />
                        )}
                        {isSending ? "Gonderiliyor" : "Gonder"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
