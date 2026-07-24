"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  togglePazaramaProductActive,
  syncProductsToPazarama,
  syncPazaramaStockAndPrice,
} from "../actions";
import {
  Search,
  RefreshCw,
  Send,
  CheckCircle2,
  Package,
  Layers,
  Sparkles,
} from "lucide-react";
import { formatPrice } from "@/lib/helpers";

interface Product {
  id: string;
  name: string;
  slug: string;
  sku?: string | null;
  barcode?: string | null;
  listPrice: number;
  salePrice?: number | null;
  pazaramaPrice?: number | null;
  stock: number;
  images: string[];
  isPazaramaActive: boolean;
  pazaramaStatus?: string | null;
  pazaramaBatchId?: string | null;
  brand?: { name: string } | null;
}

interface PazaramaProductListProps {
  initialProducts: Product[];
}

export function PazaramaProductList({ initialProducts }: PazaramaProductListProps) {
  const [products, setProducts] = useState(initialProducts);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterActive, setFilterActive] = useState<"ALL" | "ACTIVE" | "PASSIVE">("ALL");
  const [isPending, startTransition] = useTransition();

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()));

    if (filterActive === "ACTIVE") return matchesSearch && p.isPazaramaActive;
    if (filterActive === "PASSIVE") return matchesSearch && !p.isPazaramaActive;
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
      const res = await togglePazaramaProductActive(id, currentState);
      if (res.success) {
        setProducts((prev) =>
          prev.map((p) => (p.id === id ? { ...p, isPazaramaActive: !currentState } : p))
        );
        toast.success("Ürün Pazarama yayın durumu güncellendi.");
      } else {
        toast.error("Güncelleme hatası.");
      }
    });
  };

  const handleSyncSelected = async () => {
    if (selectedIds.length === 0) {
      toast.error("Lütfen en az bir ürün seçiniz.");
      return;
    }

    startTransition(async () => {
      const res = await syncProductsToPazarama(selectedIds);
      if (res.success) {
        toast.success(res.message);
        setSelectedIds([]);
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleSyncStockSelected = async () => {
    if (selectedIds.length === 0) {
      toast.error("Lütfen en az bir ürün seçiniz.");
      return;
    }

    startTransition(async () => {
      const res = await syncPazaramaStockAndPrice(selectedIds);
      if (res.success) {
        toast.success(res.message);
        setSelectedIds([]);
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-pink-200/60 dark:border-pink-900/40">
        <CardHeader className="bg-pink-50/40 dark:bg-pink-950/20 pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-[#D81B60] dark:text-pink-400 flex items-center gap-2">
                <Layers className="w-5 h-5" />
                Pazarama Ürün Listesi ve Senkronizasyon
              </CardTitle>
              <CardDescription className="mt-1">
                Pazarama'ya göndermek veya stok/fiyat güncellemek istediğiniz ürünleri seçiniz.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleSyncSelected}
                disabled={isPending || selectedIds.length === 0}
                className="bg-[#D81B60] hover:bg-[#C2185B] text-white gap-2 shadow-sm"
              >
                <Send className="w-4 h-4" />
                Pazarama'ya Gönder ({selectedIds.length})
              </Button>

              <Button
                onClick={handleSyncStockSelected}
                disabled={isPending || selectedIds.length === 0}
                variant="outline"
                className="border-pink-200 text-pink-700 hover:bg-pink-50 gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
                Stok/Fiyat Güncelle
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-4">
          {/* Filtre ve Arama Barı */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Ürün adı, SKU veya barkod ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                size="sm"
                variant={filterActive === "ALL" ? "default" : "outline"}
                onClick={() => setFilterActive("ALL")}
                className={filterActive === "ALL" ? "bg-[#D81B60]" : ""}
              >
                Tümü ({products.length})
              </Button>
              <Button
                size="sm"
                variant={filterActive === "ACTIVE" ? "default" : "outline"}
                onClick={() => setFilterActive("ACTIVE")}
                className={filterActive === "ACTIVE" ? "bg-green-600" : ""}
              >
                Yayındakiler ({products.filter((p) => p.isPazaramaActive).length})
              </Button>
              <Button
                size="sm"
                variant={filterActive === "PASSIVE" ? "default" : "outline"}
                onClick={() => setFilterActive("PASSIVE")}
                className={filterActive === "PASSIVE" ? "bg-gray-600" : ""}
              >
                Pasif olanlar ({products.filter((p) => !p.isPazaramaActive).length})
              </Button>
            </div>
          </div>

          {/* Ürün Tablosu */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={
                        filteredProducts.length > 0 &&
                        selectedIds.length === filteredProducts.length
                      }
                      onChange={(e) => handleToggleAll(e.target.checked)}
                      className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                    />
                  </TableHead>
                  <TableHead className="w-16">Görsel</TableHead>
                  <TableHead>Ürün Adı & Kodlar</TableHead>
                  <TableHead>Marka</TableHead>
                  <TableHead>Stok</TableHead>
                  <TableHead>Site Fiyatı</TableHead>
                  <TableHead>Pazarama Fiyatı</TableHead>
                  <TableHead className="text-center">Pazarama Yayın</TableHead>
                  <TableHead className="text-right">Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Arama kriterlerine uygun ürün bulunamadı.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => {
                    const isSelected = selectedIds.includes(product.id);
                    return (
                      <TableRow key={product.id} className={isSelected ? "bg-pink-50/30" : ""}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(product.id)}
                            className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="w-10 h-10 relative rounded border overflow-hidden bg-muted flex items-center justify-center">
                            {product.images[0] ? (
                              <Image
                                src={product.images[0]}
                                alt={product.name}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <Package className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="font-medium text-sm truncate">{product.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            {product.sku && <span>SKU: {product.sku}</span>}
                            {product.barcode && <span>Barkod: {product.barcode}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {product.brand?.name || "-"}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`font-semibold text-xs px-2 py-0.5 rounded-full ${
                              product.stock > 0
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {product.stock} adet
                          </span>
                        </TableCell>
                        <TableCell className="font-semibold text-sm">
                          {formatPrice(product.salePrice || product.listPrice)}
                        </TableCell>
                        <TableCell className="font-semibold text-sm text-pink-700">
                          {product.pazaramaPrice
                            ? formatPrice(product.pazaramaPrice)
                            : formatPrice(product.salePrice || product.listPrice)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={product.isPazaramaActive}
                            onCheckedChange={() =>
                              handleToggleActive(product.id, product.isPazaramaActive)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            {product.isPazaramaActive ? (
                              <Badge className="bg-pink-100 text-pink-700 border-pink-200">
                                <Sparkles className="w-3 h-3 mr-1 text-pink-600" />
                                {product.pazaramaStatus || "Aktif"}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                Pasif
                              </Badge>
                            )}
                            {product.pazaramaBatchId && (
                              <button
                                type="button"
                                onClick={async () => {
                                  toast.info(`Paket ${product.pazaramaBatchId} sorgulanıyor...`);
                                  const { checkPazaramaBatchStatus } = await import("../actions");
                                  const res = await checkPazaramaBatchStatus(product.pazaramaBatchId!);
                                  if (res.success) {
                                    alert(`Pazarama Paket Durumu:\n\n` + JSON.stringify(res.data, null, 2));
                                  } else {
                                    toast.error(res.message || "Paket sorgulanamadı.");
                                  }
                                }}
                                className="text-[10px] text-pink-600 underline font-mono hover:text-pink-800"
                              >
                                Paket Logu Gör
                              </button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
