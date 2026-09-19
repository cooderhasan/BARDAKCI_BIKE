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
  setPttavmProductCategory,
  setBulkPttavmProductCategory,
} from "../actions";
import {
  Search,
  RefreshCw,
  Send,
  CheckCircle2,
  Package,
  Activity,
  Tag,
  Edit3,
  Save,
  X,
  Plus,
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
  hasCategoryOverride?: boolean;
  pttavmCategoryName?: string | null;
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

  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatValue, setEditCatValue] = useState("");
  const [bulkCatModalOpen, setBulkCatModalOpen] = useState(false);
  const [bulkCatValue, setBulkCatValue] = useState("");
  const [savingCat, setSavingCat] = useState(false);

  const handleSaveCatId = async (productId: string, valToSave?: string) => {
    setSavingCat(true);
    const targetVal = valToSave !== undefined ? valToSave : editCatValue;
    const catNum = targetVal.trim() ? parseInt(targetVal.trim(), 10) : null;
    if (targetVal.trim() && isNaN(catNum!)) {
      toast.error("Geçerli bir sayısal ePttAVM Kategori ID girin.");
      setSavingCat(false);
      return;
    }
    const res = await setPttavmProductCategory(productId, catNum);
    setSavingCat(false);
    if (res.success) {
      toast.success(res.message);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? {
                ...p,
                pttavmCategoryId: catNum,
                hasCategoryOverride: Boolean(catNum),
              }
            : p
        )
      );
      setEditingCatId(null);
      setEditCatValue("");
    } else {
      toast.error((res as any).error || res.message || "İşlem başarısız.");
    }
  };

  const handleBulkCatAssign = async () => {
    if (selectedIds.length === 0) {
      toast.warning("Lütfen en az bir ürün seçin.");
      return;
    }
    const catNum = parseInt(bulkCatValue.trim(), 10);
    if (isNaN(catNum) || catNum <= 0) {
      toast.warning("Lütfen geçerli bir ePttAVM Kategori ID girin.");
      return;
    }
    setSavingCat(true);
    const res = await setBulkPttavmProductCategory(selectedIds, catNum);
    setSavingCat(false);
    if (res.success) {
      toast.success(res.message);
      setProducts((prev) =>
        prev.map((p) =>
          selectedIds.includes(p.id)
            ? {
                ...p,
                pttavmCategoryId: catNum,
                hasCategoryOverride: true,
              }
            : p
        )
      );
      setBulkCatModalOpen(false);
      setBulkCatValue("");
      setSelectedIds([]);
    } else {
      toast.error((res as any).error || res.message || "İşlem başarısız.");
    }
  };

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

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBulkCatModalOpen(!bulkCatModalOpen)}
            disabled={selectedIds.length === 0}
            className="border-purple-200 text-purple-700 hover:bg-purple-50 gap-1.5"
          >
            <Tag className="w-3.5 h-3.5 text-purple-600" />
            Toplu Kategori Ata ({selectedIds.length})
          </Button>

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

      {/* Toplu Kategori Atama Paneli */}
      {bulkCatModalOpen && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 rounded-xl p-4 shadow-sm">
          <Tag className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5 sm:mt-0" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-semibold text-purple-800 dark:text-purple-300">
              Seçili {selectedIds.length} ürüne ePttAVM Kategori ID ata
            </p>
            <p className="text-xs text-purple-600 dark:text-purple-400">
              Bu ürünler site kategorisi yerine doğrudan belirlediğiniz ePttAVM kategorisine gönderilecektir.
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Input
              placeholder="ePttAVM Kategori ID (örn: 567)"
              type="number"
              value={bulkCatValue}
              onChange={(e) => setBulkCatValue(e.target.value)}
              className="h-9 w-full sm:w-56 text-sm bg-white dark:bg-gray-800 font-mono"
            />
            <Button
              size="sm"
              onClick={handleBulkCatAssign}
              disabled={savingCat || !bulkCatValue.trim()}
              className="bg-purple-600 hover:bg-purple-700 text-white shrink-0"
            >
              {savingCat ? "Kaydediliyor..." : "Uygula"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setBulkCatModalOpen(false)}
              className="shrink-0"
            >
              İptal
            </Button>
          </div>
        </div>
      )}

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
                          <div className="space-y-1">
                            <p className="font-medium text-sm line-clamp-1">{product.name}</p>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {product.brand?.name && (
                                <span className="text-xs text-muted-foreground">{product.brand.name}</span>
                              )}

                              {product.hasCategoryOverride ? (
                                <div className="inline-flex items-center gap-1">
                                  <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-950/40 dark:text-purple-300 border-purple-300 text-[10px] font-bold py-0 px-1.5">
                                    ⭐ Özel Kat: #{product.pttavmCategoryId}
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4 text-muted-foreground hover:text-purple-600"
                                    onClick={() => {
                                      setEditingCatId(product.id);
                                      setEditCatValue(String(product.pttavmCategoryId || ""));
                                    }}
                                    title="Özel kategoriyi düzenle / kaldır"
                                  >
                                    <Edit3 className="w-2.5 h-2.5" />
                                  </Button>
                                </div>
                              ) : product.pttavmCategoryId ? (
                                <div className="inline-flex items-center gap-1">
                                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-teal-700 border-teal-200">
                                    Kat ID: #{product.pttavmCategoryId}
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4 text-gray-400 hover:text-purple-600"
                                    onClick={() => {
                                      setEditingCatId(product.id);
                                      setEditCatValue("");
                                    }}
                                    title="Bu ürüne özel ePttAVM kategorisi ata"
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1">
                                  <Badge variant="outline" className="text-[10px] text-red-500 border-red-200 py-0 px-1.5">
                                    Kategori Tanımsız
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4 text-purple-600 hover:bg-purple-50"
                                    onClick={() => {
                                      setEditingCatId(product.id);
                                      setEditCatValue("");
                                    }}
                                    title="Bu ürüne özel ePttAVM kategorisi ata"
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                  </Button>
                                </div>
                              )}
                            </div>

                            {editingCatId === product.id && (
                              <div className="flex items-center gap-1 p-1 bg-white dark:bg-gray-800 border border-purple-300 rounded-md shadow-sm z-10 w-fit" onClick={(e) => e.stopPropagation()}>
                                <Input
                                  type="number"
                                  value={editCatValue}
                                  onChange={(e) => setEditCatValue(e.target.value)}
                                  placeholder="ePttAVM Kat ID"
                                  className="h-6 text-[10px] w-24 px-1 font-mono"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveCatId(product.id);
                                    if (e.key === "Escape") setEditingCatId(null);
                                  }}
                                />
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-emerald-600 hover:bg-emerald-50" onClick={() => handleSaveCatId(product.id)} disabled={savingCat} title="Kaydet">
                                  <Save className="h-3 w-3" />
                                </Button>
                                {product.hasCategoryOverride && (
                                  <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500 hover:bg-red-50" onClick={() => handleSaveCatId(product.id, "")} disabled={savingCat} title="Özel kategoriyi sil (Site eşleşmesine dön)">
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-gray-400" onClick={() => setEditingCatId(null)}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
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
