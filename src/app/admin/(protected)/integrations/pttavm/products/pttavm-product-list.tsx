"use client";

import { useState, useEffect, useTransition } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  togglePttavmProductActive,
  syncProductsToPttavm,
  syncPttavmStockAndPrice,
  checkPttavmTrackingResult,
} from "../actions";
import {
  Search,
  RefreshCw,
  Send,
  CheckCircle2,
  Package,
  Activity,
} from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { formatPrice } from "@/lib/helpers";

interface Product {
  id: string;
  name: string;
  slug: string;
  sku?: string | null;
  barcode?: string | null;
  listPrice: number;
  salePrice?: number | null;
  pttavmPrice?: number | null;
  stock: number;
  images: string[];
  isPttavmActive: boolean;
  pttavmStatus?: string | null;
  trackingId?: string | null;
  pttavmCategoryId?: number | null;
  brand?: { name: string } | null;
}

import { MarketplacePagination } from "@/components/admin/marketplace-pagination";

interface PttavmProductListProps {
  initialProducts: Product[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
  };
}

export function PttavmProductList({ initialProducts, pagination }: PttavmProductListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [products, setProducts] = useState(initialProducts);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterActive, setFilterActive] = useState<"ALL" | "ACTIVE" | "PASSIVE">("ALL");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  useEffect(() => {
    setSearchTerm(searchParams.get("search") || "");
  }, [searchParams]);

  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
    const params = new URLSearchParams(searchParams.toString());
    if (term.trim()) {
      params.set("search", term.trim());
      params.set("page", "1");
    } else {
      params.delete("search");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const filteredProducts = products.filter((p) => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !term ||
      p.name.toLowerCase().includes(term) ||
      (p.sku && p.sku.toLowerCase().includes(term)) ||
      (p.barcode && p.barcode.toLowerCase().includes(term));

    if (filterActive === "ACTIVE") return matchesSearch && p.isPttavmActive;
    if (filterActive === "PASSIVE") return matchesSearch && !p.isPttavmActive;
    return matchesSearch;
  });

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredProducts.map((p) => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleActive = (id: string, currentState: boolean) => {
    startTransition(async () => {
      const res = await togglePttavmProductActive(id, currentState);
      if (res.success) {
        setProducts((prev) =>
          prev.map((p) => (p.id === id ? { ...p, isPttavmActive: !currentState } : p))
        );
        toast.success(
          !currentState
            ? "Ürün ePttAVM için satışa açıldı"
            : "Ürün ePttAVM satışına kapatıldı"
        );
      } else {
        toast.error("Durum güncellenirken hata oluştu.");
      }
    });
  };

  const handleSyncSelectedStockAndPrice = () => {
    if (selectedIds.length === 0) {
      toast.warning("Lütfen senkronize edilecek en az 1 ürün seçin.");
      return;
    }

    startTransition(async () => {
      const loadingToast = toast.loading(`${selectedIds.length} ürün için ePttAVM stok/fiyat güncelleniyor...`);
      const res = await syncPttavmStockAndPrice(selectedIds);
      toast.dismiss(loadingToast);

      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleSendSelectedProducts = () => {
    if (selectedIds.length === 0) {
      toast.warning("Lütfen ePttAVM kataloğuna aktarılacak en az 1 ürün seçin.");
      return;
    }

    startTransition(async () => {
      const loadingToast = toast.loading(`${selectedIds.length} ürün ePttAVM kataloğuna gönderiliyor (upsert)...`);
      const res = await syncProductsToPttavm(selectedIds);
      toast.dismiss(loadingToast);

      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleCheckTracking = (trackingId: string) => {
    startTransition(async () => {
      const loadingToast = toast.loading(`Tracking ID [${trackingId}] sorgulanıyor...`);
      const res = await checkPttavmTrackingResult(trackingId);
      toast.dismiss(loadingToast);

      if (res.success) {
        const status = res.data?.status || "Bilinmiyor";
        const progress = res.data?.progress !== undefined ? `${res.data.progress}%` : "";
        toast.info(`İşlem Durumu: ${status} ${progress}`, {
          description: `Toplam: ${res.data?.productsSubTrackingResult?.countOfTotalProducts ?? "-"}, Tamamlanan: ${res.data?.productsSubTrackingResult?.countOfCompletedProducts ?? "-"}`,
        });
      } else {
        toast.error(res.message || "Durum sorgulanamadı.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {pagination ? (
        <MarketplacePagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalCount={pagination.totalCount}
          limit={pagination.limit}
        />
      ) : null}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ürün adı, SKU veya barkod ara..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>

          <div className="flex items-center border rounded-lg p-1 bg-muted/30">
            <Button
              variant={filterActive === "ALL" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFilterActive("ALL")}
            >
              Tümü ({products.length})
            </Button>
            <Button
              variant={filterActive === "ACTIVE" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs text-teal-600"
              onClick={() => setFilterActive("ACTIVE")}
            >
              Aktif ({products.filter((p) => p.isPttavmActive).length})
            </Button>
            <Button
              variant={filterActive === "PASSIVE" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs text-gray-500"
              onClick={() => setFilterActive("PASSIVE")}
            >
              Pasif ({products.filter((p) => !p.isPttavmActive).length})
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {selectedIds.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="border-teal-200 text-teal-700 hover:bg-teal-50 gap-1.5"
                onClick={handleSyncSelectedStockAndPrice}
                disabled={isPending}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
                Stok/Fiyat Güncelle ({selectedIds.length})
              </Button>

              <Button
                size="sm"
                className="bg-[#00A896] hover:bg-[#00897B] text-white gap-1.5 shadow-sm"
                onClick={handleSendSelectedProducts}
                disabled={isPending}
              >
                <Send className="w-3.5 h-3.5" />
                ePttAVM'ye Aktar ({selectedIds.length})
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <span>Ürün Listesi ({filteredProducts.length})</span>
            {selectedIds.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                {selectedIds.length} ürün seçildi
              </span>
            )}
          </CardTitle>
          <CardDescription>
            ePttAVM pazaryerinde yayınlanacak ürünleri seçin ve güncellemeleri anlık olarak iletin.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                    checked={
                      filteredProducts.length > 0 &&
                      selectedIds.length === filteredProducts.length
                    }
                    onChange={(e) => handleToggleAll(e.target.checked)}
                  />
                </TableHead>
                <TableHead>Ürün</TableHead>
                <TableHead>Barkod / SKU</TableHead>
                <TableHead className="text-right">Liste / İndirimli</TableHead>
                <TableHead className="text-right">ePttAVM Fiyatı</TableHead>
                <TableHead className="text-center">Stok</TableHead>
                <TableHead className="text-center">ePttAVM Durumu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    Ürün bulunamadı.
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => {
                  const isSelected = selectedIds.includes(product.id);
                  const image = product.images?.[0] || "/placeholder.png";

                  return (
                    <TableRow key={product.id} className={isSelected ? "bg-teal-50/40 dark:bg-teal-950/20" : ""}>
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(product.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 overflow-hidden rounded-md border bg-muted shrink-0">
                            <Image
                              src={image}
                              alt={product.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                          <div>
                            <p className="font-medium text-sm line-clamp-1">{product.name}</p>
                            {product.brand?.name && (
                              <p className="text-xs text-muted-foreground">{product.brand.name}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-0.5">
                          <p className="font-mono">{product.barcode || "-"}</p>
                          <p className="text-muted-foreground">{product.sku || "-"}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        <div>
                          <p className="font-medium">{formatPrice(product.listPrice)}</p>
                          {product.salePrice && (
                            <p className="text-muted-foreground line-through">
                              {formatPrice(product.salePrice)}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-sm text-teal-600">
                          {product.pttavmPrice
                            ? formatPrice(product.pttavmPrice)
                            : formatPrice(product.salePrice || product.listPrice)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={product.stock > 0 ? "outline" : "destructive"}
                          className="text-xs"
                        >
                          {product.stock} Adet
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <Switch
                            checked={product.isPttavmActive}
                            onCheckedChange={() =>
                              handleToggleActive(product.id, product.isPttavmActive)
                            }
                            disabled={isPending}
                          />
                          <span className="text-[10px] text-muted-foreground">
                            {product.isPttavmActive ? (
                              <span className="text-teal-600 font-medium">Yayında</span>
                            ) : (
                              "Pasif"
                            )}
                          </span>
                          {product.trackingId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-teal-600 gap-1 mt-0.5"
                              onClick={() => handleCheckTracking(product.trackingId!)}
                              title={`Tracking ID: ${product.trackingId}`}
                            >
                              <Activity className="w-3 h-3 text-teal-600" />
                              Durum
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
