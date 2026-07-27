"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { syncProductsToCiceksepeti, toggleCiceksepetiProductStatus } from "../actions";
import { toast } from "sonner";
import { RefreshCw, Search, Send, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import Image from "next/image";

interface Props {
  initialProducts: any[];
}

export function CiceksepetiProductList({ initialProducts }: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "SYNCED" | "ERROR" | "PENDING">("ALL");
  const [loading, setLoading] = useState(false);

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (statusFilter === "SYNCED") return p.ciceksepetiProduct?.isSynced && !p.ciceksepetiProduct?.lastSyncError;
    if (statusFilter === "ERROR") return Boolean(p.ciceksepetiProduct?.lastSyncError);
    if (statusFilter === "PENDING") return !p.ciceksepetiProduct?.isSynced;

    return true;
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProducts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProducts.map((p) => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  async function handleSyncSelected(syncType: "all" | "prices") {
    if (selectedIds.length === 0) {
      toast.warning("Lütfen işlem yapılacak ürünleri seçin.");
      return;
    }

    setLoading(true);
    toast.info(`${selectedIds.length} ürün Çiçeksepeti'ye aktarılıyor...`);

    const res = await syncProductsToCiceksepeti(selectedIds, syncType);
    setLoading(false);

    if (res.success) {
      toast.success(res.message);
      setSelectedIds([]);
    } else {
      toast.error(res.error);
    }
  }

  async function handleToggleStatus(productId: string, currentActive: boolean) {
    const res = await toggleCiceksepetiProductStatus(productId, !currentActive);
    if (res.success) {
      toast.success(!currentActive ? "Ürün Çiçeksepeti satışına açıldı." : "Ürün Çiçeksepeti satışına kapatıldı.");
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, isCiceksepetiActive: !currentActive } : p))
      );
    } else {
      toast.error(res.error || "İşlem başarısız.");
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Filter and Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-4 rounded-xl border">
        <div className="flex flex-1 items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ürün adı, barkod veya SKU ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          <div className="flex gap-1">
            <Button
              variant={statusFilter === "ALL" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("ALL")}
              className="text-xs"
            >
              Tümü ({products.length})
            </Button>
            <Button
              variant={statusFilter === "SYNCED" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("SYNCED")}
              className="text-xs text-emerald-700 dark:text-emerald-400"
            >
              Başarılı
            </Button>
            <Button
              variant={statusFilter === "ERROR" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("ERROR")}
              className="text-xs text-red-700 dark:text-red-400"
            >
              Hatalı
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSyncSelected("prices")}
            disabled={loading || selectedIds.length === 0}
            className="border-rose-200 text-rose-700 hover:bg-rose-50"
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Seçilen Fiyat/Stok Güncelle ({selectedIds.length})
          </Button>

          <Button
            size="sm"
            onClick={() => handleSyncSelected("all")}
            disabled={loading || selectedIds.length === 0}
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Seçilenleri Aktar ({selectedIds.length})
          </Button>
        </div>
      </div>

      {/* Product List Table */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12 text-center">
                <Checkbox
                  checked={selectedIds.length === filteredProducts.length && filteredProducts.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="w-16">Görsel</TableHead>
              <TableHead>Ürün Adı & Kategori</TableHead>
              <TableHead className="w-32">Barkod / SKU</TableHead>
              <TableHead className="w-28 text-right">Fiyat (Çiçeksepeti)</TableHead>
              <TableHead className="w-20 text-center">Stok</TableHead>
              <TableHead className="w-40 text-center">Çiçeksepeti Durumu</TableHead>
              <TableHead className="w-24 text-center">İşlem</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Arama kriterlerine uygun ürün bulunamadı.
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((p) => {
                const cicekProduct = p.ciceksepetiProduct;
                const isSelected = selectedIds.includes(p.id);

                return (
                  <TableRow key={p.id} className={isSelected ? "bg-rose-50/30 dark:bg-rose-950/10" : ""}>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(p.id)}
                      />
                    </TableCell>

                    <TableCell>
                      <div className="w-10 h-10 rounded-md overflow-hidden bg-muted relative border">
                        {p.images && p.images[0] ? (
                          <Image
                            src={p.images[0]}
                            alt={p.name}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                            Görsel Yok
                          </div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="space-y-0.5">
                        <span className="font-medium text-sm line-clamp-1">{p.name}</span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{p.categories?.[0]?.name || "Kategori Yok"}</span>
                          {p.ciceksepetiCategoryId && (
                            <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200">
                              ÇS Cat ID: {p.ciceksepetiCategoryId}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="font-mono text-xs text-muted-foreground">
                      <div>{p.barcode || "-"}</div>
                      <div className="text-[10px] text-gray-400">{p.sku}</div>
                    </TableCell>

                    <TableCell className="text-right font-medium text-sm">
                      {p.ciceksepetiPrice ? (
                        <div className="text-rose-700 font-semibold">{Number(p.ciceksepetiPrice).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}</div>
                      ) : (
                        <div>{Number(p.salePrice || p.listPrice).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}</div>
                      )}
                    </TableCell>

                    <TableCell className="text-center">
                      <Badge variant={p.stock <= 0 ? "destructive" : p.stock <= 10 ? "secondary" : "outline"}>
                        {p.stock}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-center">
                      {cicekProduct?.lastSyncError ? (
                        <div className="space-y-1">
                          <Badge variant="destructive" className="gap-1 text-[11px]">
                            <XCircle className="w-3 h-3" />
                            Hata
                          </Badge>
                          <p className="text-[10px] text-red-600 line-clamp-1" title={cicekProduct.lastSyncError}>
                            {cicekProduct.lastSyncError}
                          </p>
                        </div>
                      ) : cicekProduct?.isSynced ? (
                        <div className="space-y-1">
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-[11px]">
                            <CheckCircle2 className="w-3 h-3" />
                            Eşleşti
                          </Badge>
                          {cicekProduct.batchRequestId && (
                            <p className="text-[10px] text-muted-foreground font-mono">
                              Batch: {cicekProduct.batchRequestId}
                            </p>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-[11px] text-amber-700 border-amber-300 bg-amber-50">
                          <Clock className="w-3 h-3" />
                          Gönderilmedi
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(p.id, p.isCiceksepetiActive)}
                        className={`text-xs ${p.isCiceksepetiActive ? "text-emerald-700 hover:bg-emerald-50" : "text-gray-500"}`}
                      >
                        {p.isCiceksepetiActive ? "Aktif" : "Pasif"}
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
