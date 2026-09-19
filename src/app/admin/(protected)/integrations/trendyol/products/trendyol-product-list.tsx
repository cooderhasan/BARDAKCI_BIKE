
"use client";

import { useState, useEffect } from "react";
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    Search, 
    Send, 
    RefreshCcw, 
    AlertCircle, 
    CheckCircle2, 
    ExternalLink,
    Box,
    History,
    Tag,
    Edit3,
    Save,
    X,
    Plus
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { 
    sendProductToTrendyol, 
    getTrendyolCategoryAttributes, 
    enqueueTrendyolSync,
    setTrendyolProductCategory,
    setBulkTrendyolProductCategory
} from "../actions";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MarketplacePagination } from "@/components/admin/marketplace-pagination";
import { AttributeSearchableSelect } from "./attribute-searchable-select";

interface TrendyolProductListProps {
    initialProducts: any[];
    pagination?: {
        currentPage: number;
        totalPages: number;
        totalCount: number;
        limit: number;
    };
}

export function TrendyolProductList({ initialProducts, pagination }: TrendyolProductListProps) {
    const [search, setSearch] = useState("");
    const [products, setProducts] = useState(initialProducts);

    useEffect(() => {
        setProducts(initialProducts);
    }, [initialProducts]);
    const [loadingProductId, setLoadingProductId] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);
    
    // Attribute Modal State
    const [showAttrModal, setShowAttrModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [categoryAttrs, setCategoryAttrs] = useState<any[]>([]);
    const [attrMappings, setAttrMappings] = useState<any>({});
    const [attrLoading, setAttrLoading] = useState(false);

    const handleBulkSync = async () => {
        setSyncing(true);
        try {
            const res = await enqueueTrendyolSync();
            if (res.success) {
                toast.success(res.message, {
                    description: "Ürünler arka planda sırayla güncelleniyor. Panelden çıkış yapabilirsiniz.",
                    duration: 5000
                });
            } else {
                toast.error(res.message);
            }
        } catch (error) {
            toast.error("Kuyruk işlemi başlatılamadı.");
        } finally {
            setSyncing(false);
        }
    };

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
            toast.error("Geçerli bir sayısal Trendyol Kategori ID girin.");
            setSavingCat(false);
            return;
        }
        const res = await setTrendyolProductCategory(productId, catNum);
        setSavingCat(false);
        if (res.success) {
            toast.success(res.message);
            setProducts((prev) =>
                prev.map((p) =>
                    p.id === productId
                        ? {
                              ...p,
                              trendyolProduct: {
                                  ...(p.trendyolProduct || {}),
                                  trendyolCategoryId: catNum,
                              },
                          }
                        : p
                )
            );
            setEditingCatId(null);
            setEditCatValue("");
        } else {
            toast.error(res.message || "İşlem başarısız.");
        }
    };

    const handleBulkCatAssign = async () => {
        if (selectedIds.length === 0) {
            toast.warning("Lütfen en az bir ürün seçin.");
            return;
        }
        const catNum = parseInt(bulkCatValue.trim(), 10);
        if (isNaN(catNum) || catNum <= 0) {
            toast.warning("Lütfen geçerli bir Trendyol Kategori ID girin.");
            return;
        }
        setSavingCat(true);
        const res = await setBulkTrendyolProductCategory(selectedIds, catNum);
        setSavingCat(false);
        if (res.success) {
            toast.success(res.message);
            setProducts((prev) =>
                prev.map((p) =>
                    selectedIds.includes(p.id)
                        ? {
                              ...p,
                              trendyolProduct: {
                                  ...(p.trendyolProduct || {}),
                                  trendyolCategoryId: catNum,
                              },
                          }
                        : p
                )
            );
            setBulkCatModalOpen(false);
            setBulkCatValue("");
            setSelectedIds([]);
        } else {
            toast.error(res.message || "İşlem başarısız.");
        }
    };

    const handleOpenWizard = async (product: any, overrideCatId?: number) => {
        const productOverrideCatId = product.trendyolProduct?.trendyolCategoryId;
        const mappedCats = product.categories.filter((c: any) => c.trendyolCategoryId !== null);

        let catId: number | null = null;
        if (overrideCatId) {
            catId = overrideCatId;
        } else if (productOverrideCatId) {
            catId = productOverrideCatId;
        } else if (mappedCats.length > 0) {
            const activeCat = mappedCats.find((c: any) => c.name?.toLowerCase().includes("iç lastik") || c.name?.toLowerCase().includes("lastik")) || mappedCats[0];
            catId = activeCat.trendyolCategoryId;
        }

        if (!catId) {
            toast.error("Önce kategoriyi Trendyol ile eşleştirmelisiniz veya ürüne özel Trendyol Kategori ID girmelisiniz.");
            return;
        }

        setSelectedProduct(product);
        setSelectedCategoryId(catId);
        setShowAttrModal(true);
        setAttrLoading(true);
        setAttrMappings({});

        try {
            const res = await getTrendyolCategoryAttributes(catId);
            if (res.success) {
                const attrs = res.data || [];
                setCategoryAttrs(attrs);

                // Smart pre-fill for known required attributes
                const initialMap: any = {};
                for (const a of attrs) {
                    const attrId = a.attribute.id;
                    if (a.attributeValues && a.attributeValues.length > 0) {
                        // Tek Ebat (Beden - 338)
                        if (attrId === 338) {
                            const tekEbat = a.attributeValues.find((v: any) => v.name?.toLowerCase().includes("tek ebat"));
                            if (tekEbat) initialMap[338] = tekEbat.id;
                        }
                        // Menşei (1192) - TR veya CN
                        if (attrId === 1192) {
                            const tr = a.attributeValues.find((v: any) => v.name === "TR" || v.name === "Türkiye");
                            const cn = a.attributeValues.find((v: any) => v.name === "CN" || v.name === "Çin");
                            if (tr) initialMap[1192] = tr.id;
                            else if (cn) initialMap[1192] = cn.id;
                        }
                        // Web Color (348) - Siyah
                        if (attrId === 348) {
                            const siyah = a.attributeValues.find((v: any) => v.name?.toLowerCase() === "siyah");
                            if (siyah) initialMap[348] = siyah.id;
                        }
                        // Renk (47)
                        if (attrId === 47) {
                            const siyah = a.attributeValues.find((v: any) => v.name?.toLowerCase() === "siyah");
                            if (siyah) initialMap[47] = siyah.id;
                        }
                    } else if (attrId === 47) {
                        // Renk (47)
                        initialMap[47] = "Siyah";
                    }
                }
                setAttrMappings(initialMap);
            } else {
                toast.error(res.message);
                setShowAttrModal(false);
            }
        } catch (error) {
            toast.error("Özellikler yüklenemedi.");
            setShowAttrModal(false);
        } finally {
            setAttrLoading(false);
        }
    };

    const handleSend = async () => {
        if (!selectedProduct) return;
        
        // Convert mappings to Trendyol format, filtering out empty values
        const finalAttrs = Object.entries(attrMappings)
            .filter(([_, val]) => val !== undefined && val !== "" && val !== null)
            .map(([id, val]) => ({
                attributeId: Number(id),
                attributeValueId: typeof val === "number" ? val : undefined,
                customAttributeValue: typeof val === "string" ? val.trim() : undefined
            }));

        setLoadingProductId(selectedProduct.id);
        setShowAttrModal(false);

        try {
            const res = await sendProductToTrendyol(selectedProduct.id, finalAttrs, selectedCategoryId || undefined);
            if (res.success) {
                toast.success(res.message);
                // Update local state
                setProducts(prev => prev.map(p => 
                    p.id === selectedProduct.id 
                    ? { ...p, trendyolProduct: { isSynced: true, lastSyncedAt: new Date() } }
                    : p
                ));
            } else {
                toast.error(res.message);
            }
        } catch (error) {
            toast.error("Gönderim sırasında hata oluştu.");
        } finally {
            setLoadingProductId(null);
        }
    };

    const handleQuickSync = async (product: any) => {
        setLoadingProductId(product.id);
        try {
            const res = await sendProductToTrendyol(product.id, []); // Boş dizi gönderilirse sadece stok/fiyat güncellenir (veya mevcut verilerle tekrar yollanır)
            if (res.success) {
                toast.success("Stok ve Fiyat başarıyla güncellendi.");
            } else {
                toast.error(res.message);
            }
        } catch (error) {
            toast.error("Güncelleme başarısız.");
        } finally {
            setLoadingProductId(null);
        }
    };

    const filteredProducts = pagination ? products : products.filter(p => 
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku?.toLowerCase().includes(search.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-4">
            {pagination ? (
                <MarketplacePagination
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                    totalCount={pagination.totalCount}
                    limit={pagination.limit}
                />
            ) : null}

            <div className="flex flex-col md:flex-row md:items-center gap-4 bg-white dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                {!pagination && (
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                            placeholder="Ürün adı, barkod veya SKU ara..." 
                            className="pl-10 border-none bg-gray-50 dark:bg-gray-800/50 focus-visible:ring-orange-500"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                )}
                <div className="flex items-center gap-3 ml-auto">
                    <Link href="/admin/integrations/trendyol/batches">
                        <Button 
                            variant="outline"
                            className="border-orange-200 text-orange-600 hover:bg-orange-50 gap-2 h-10 px-4 rounded-xl shadow-sm transition-all active:scale-95"
                        >
                            <History className="w-4 h-4" />
                            <span className="hidden sm:inline">İşlem Geçmişi (Batch İzle)</span>
                            <span className="sm:hidden">Geçmiş</span>
                        </Button>
                    </Link>

                    <Button
                        variant="outline"
                        onClick={() => setBulkCatModalOpen(!bulkCatModalOpen)}
                        disabled={selectedIds.length === 0}
                        className="border-purple-200 text-purple-700 hover:bg-purple-50 gap-2 h-10 px-4 rounded-xl shadow-sm transition-all"
                    >
                        <Tag className="w-4 h-4 text-purple-600" />
                        <span>Toplu Kategori Ata ({selectedIds.length})</span>
                    </Button>

                    <Button 
                        onClick={handleBulkSync} 
                        disabled={syncing}
                        variant="outline"
                        className="border-orange-200 text-orange-600 hover:bg-orange-50 gap-2 h-10 px-4 rounded-xl shadow-sm transition-all active:scale-95"
                    >
                        {syncing ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                        <span className="hidden sm:inline">Tümünü Kuyrukta Güncelle</span>
                        <span className="sm:hidden">Toplu Güncelle</span>
                    </Button>

                    {pagination ? (
                        <Badge variant="outline" className="h-10 px-4 rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/20 dark:text-orange-400 border-orange-100 dark:border-orange-900 font-bold">
                            TOPLAM {pagination.totalCount.toLocaleString("tr-TR")} ÜRÜN
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="h-10 px-4 rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/20 dark:text-orange-400 border-orange-100 dark:border-orange-900 font-bold">
                            {initialProducts.length} ÜRÜN
                        </Badge>
                    )}
                </div>
            </div>

            {/* Toplu Kategori Atama Paneli */}
            {bulkCatModalOpen && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 rounded-xl p-4 shadow-sm">
                    <Tag className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5 sm:mt-0" />
                    <div className="flex-1 space-y-1">
                        <p className="text-sm font-semibold text-purple-800 dark:text-purple-300">
                            Seçili {selectedIds.length} ürüne Trendyol Kategori ID ata
                        </p>
                        <p className="text-xs text-purple-600 dark:text-purple-400">
                            Bu ürünler site kategorisi yerine doğrudan belirlediğiniz Trendyol kategorisine gönderilecektir.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Input
                            placeholder="Trendyol Kategori ID (örn: 1045)"
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

            <div className="bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-gray-50/50 dark:bg-gray-800/50">
                        <TableRow>
                            <TableHead className="w-[40px]">
                                <Checkbox
                                    checked={selectedIds.length === filteredProducts.length && filteredProducts.length > 0}
                                    onCheckedChange={(checked) => {
                                        if (checked) {
                                            setSelectedIds(filteredProducts.map((p) => p.id));
                                        } else {
                                            setSelectedIds([]);
                                        }
                                    }}
                                />
                            </TableHead>
                            <TableHead className="w-[80px]">Görsel</TableHead>
                            <TableHead>Ürün Bilgisi</TableHead>
                            <TableHead>Fiyat / Stok</TableHead>
                            <TableHead>Kategori / Marka</TableHead>
                            <TableHead>Durum</TableHead>
                            <TableHead className="text-right">İşlem</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredProducts.map((product) => {
                            const isSynced = !!product.trendyolProduct?.isSynced;
                            const mappedCat = product.categories.find((c: any) => c.trendyolCategoryId !== null);
                            const mappedBrand = product.brand?.trendyolBrandId !== null;
                            const isSelected = selectedIds.includes(product.id);

                            return (
                                <TableRow key={product.id} className="hover:bg-orange-50/10 transition-colors">
                                    <TableCell>
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    setSelectedIds((prev) => [...prev, product.id]);
                                                } else {
                                                    setSelectedIds((prev) => prev.filter((id) => id !== product.id));
                                                }
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div className="w-16 h-16 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
                                            {product.images?.[0] ? (
                                                <img src={product.images[0]} alt={product.name} className="object-cover w-full h-full" />
                                            ) : (
                                                <Box className="w-6 h-6 text-muted-foreground" />
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-sm line-clamp-1">{product.name}</span>
                                            <span className="text-xs text-muted-foreground font-mono">SKU: {product.sku || "-"}</span>
                                            <span className="text-[10px] text-muted-foreground">Barkod: {product.barcode || "-"}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <Badge variant="secondary" className="w-fit font-mono text-[10px]">
                                                {product.stock} Adet
                                            </Badge>
                                            <span className="font-bold text-orange-600 dark:text-orange-500">
                                                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(product.trendyolPrice || product.listPrice))}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center gap-1">
                                                {product.trendyolProduct?.trendyolCategoryId ? (
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-1">
                                                            <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-950/40 dark:text-orange-300 border-orange-300 text-[10px] font-bold">
                                                                ⭐ Özel Kat: #{product.trendyolProduct.trendyolCategoryId}
                                                            </Badge>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-5 w-5 text-muted-foreground hover:text-orange-600"
                                                                onClick={() => {
                                                                    setEditingCatId(product.id);
                                                                    setEditCatValue(String(product.trendyolProduct.trendyolCategoryId));
                                                                }}
                                                                title="Özel kategoriyi düzenle / kaldır"
                                                            >
                                                                <Edit3 className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                        {mappedCat && (
                                                            <span className="text-[9px] text-muted-foreground line-through">
                                                                Eşleşen: {mappedCat.name} (#{mappedCat.trendyolCategoryId})
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : mappedCat ? (
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-1">
                                                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 border-none text-[10px]">
                                                                {mappedCat.name}
                                                            </Badge>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-5 w-5 text-gray-400 hover:text-orange-600"
                                                                onClick={() => {
                                                                    setEditingCatId(product.id);
                                                                    setEditCatValue("");
                                                                }}
                                                                title="Bu ürüne özel Trendyol kategorisi ata"
                                                            >
                                                                <Plus className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                        <span className="text-[9px] text-muted-foreground font-mono mt-0.5">
                                                            Trendyol ID: #{mappedCat.trendyolCategoryId}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1">
                                                        <Badge variant="outline" className="text-red-500 border-red-200 text-[10px]">
                                                            Kategori Eşleşmemiş
                                                        </Badge>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-5 w-5 text-orange-600 hover:bg-orange-50"
                                                            onClick={() => {
                                                                setEditingCatId(product.id);
                                                                setEditCatValue("");
                                                            }}
                                                            title="Bu ürüne özel Trendyol kategorisi ata"
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>

                                            {editingCatId === product.id && (
                                                <div className="flex items-center gap-1 p-1 bg-white dark:bg-gray-800 border border-orange-300 rounded-md shadow-sm z-10" onClick={(e) => e.stopPropagation()}>
                                                    <Input
                                                        type="number"
                                                        value={editCatValue}
                                                        onChange={(e) => setEditCatValue(e.target.value)}
                                                        placeholder="Kat ID"
                                                        className="h-6 text-[10px] w-20 px-1 font-mono"
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") handleSaveCatId(product.id);
                                                            if (e.key === "Escape") setEditingCatId(null);
                                                        }}
                                                    />
                                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-emerald-600 hover:bg-emerald-50" onClick={() => handleSaveCatId(product.id)} disabled={savingCat} title="Kaydet">
                                                        <Save className="h-3 w-3" />
                                                    </Button>
                                                    {product.trendyolProduct?.trendyolCategoryId && (
                                                        <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500 hover:bg-red-50" onClick={() => handleSaveCatId(product.id, "")} disabled={savingCat} title="Özel kategoriyi sil (Site eşleşmesine dön)">
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    )}
                                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-gray-400" onClick={() => setEditingCatId(null)}>
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-1">
                                                {mappedBrand ? (
                                                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-[#17457C] border-none text-[10px]">
                                                        {product.brand?.name}
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-red-500 border-red-200 text-[10px]">
                                                        Marka Eşleşmemiş
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {isSynced ? (
                                            <div className="flex items-center gap-1 text-green-600 dark:text-green-500 text-xs font-medium">
                                                <CheckCircle2 className="w-4 h-4" />
                                                Senkronize
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1 text-amber-500 text-xs font-medium">
                                                <AlertCircle className="w-4 h-4" />
                                                Gönderilmedi
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            {isSynced ? (
                                                <>
                                                    <Button size="sm" variant="outline" className="gap-2 text-xs border-orange-200 text-orange-600 hover:bg-orange-50" onClick={() => handleQuickSync(product)} disabled={loadingProductId === product.id}>
                                                        <RefreshCcw className={`w-3 h-3 ${loadingProductId === product.id ? 'animate-spin' : ''}`} />
                                                        Stok/Fiyat Güncelle
                                                    </Button>
                                                    <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => handleOpenWizard(product)}>
                                                        Düzenle
                                                    </Button>
                                                </>
                                            ) : (
                                                <Button size="sm" className="gap-2 text-xs bg-orange-600 hover:bg-orange-700 text-white shadow-md shadow-orange-500/20" onClick={() => handleOpenWizard(product)} disabled={loadingProductId === product.id || !mappedCat || !mappedBrand}>
                                                    <Send className="w-3 h-3" />
                                                    Trendyol'a Gönder
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            {/* ATTRIBUTE MAPPING DIALOG */}
            <Dialog open={showAttrModal} onOpenChange={setShowAttrModal}>
                <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto rounded-3xl border-orange-100 dark:border-orange-900/30">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Box className="w-5 h-5 text-orange-500" />
                            Kategori Özelliklerini Eşleştir
                        </DialogTitle>
                        <DialogDescription>
                            Trendyol "{selectedProduct?.categories.find((c: any) => c.trendyolCategoryId === selectedCategoryId)?.name || selectedProduct?.categories[0]?.name}" kategorisi için zorunlu alanları doldurun.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Çoklu Kategori Varsa Kullanıcıya Açıkça Seçim Sun */}
                    {selectedProduct && selectedProduct.categories.filter((c: any) => c.trendyolCategoryId !== null).length > 1 && (
                        <div className="p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800 rounded-2xl space-y-1.5 mt-2">
                            <Label className="text-xs font-semibold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                                <span>⚠️ Ürünün Birden Çok Kategorisi Var. Trendyol'a Gönderilecek Kategori:</span>
                            </Label>
                            <Select 
                                value={selectedCategoryId?.toString()} 
                                onValueChange={(val) => handleOpenWizard(selectedProduct, Number(val))}
                            >
                                <SelectTrigger className="bg-white dark:bg-gray-800 font-medium text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {selectedProduct.categories
                                        .filter((c: any) => c.trendyolCategoryId !== null)
                                        .map((c: any) => (
                                            <SelectItem key={c.id} value={c.trendyolCategoryId.toString()}>
                                                {c.name} (Trendyol ID: #{c.trendyolCategoryId})
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {attrLoading ? (
                        <div className="py-12 flex flex-col items-center justify-center gap-3">
                            <RefreshCcw className="w-10 h-10 animate-spin text-orange-500" />
                            <p className="text-sm text-muted-foreground animate-pulse">Özellikler yükleniyor...</p>
                        </div>
                    ) : (
                        <div className="space-y-4 py-2">
                            {(() => {
                                const requiredAttrs = categoryAttrs.filter((a: any) => a.required);
                                const optionalAttrs = categoryAttrs.filter((a: any) => !a.required);

                                const renderField = (attr: any) => {
                                    const attrId = attr.attribute.id;
                                    const hasValues = attr.attributeValues && attr.attributeValues.length > 0;

                                    return (
                                        <div key={attrId} className="space-y-1.5">
                                            <Label className="flex items-center gap-1 text-xs font-medium">
                                                {attr.attribute.name}
                                                {attr.required ? (
                                                    <span className="text-red-500 font-bold">*</span>
                                                ) : (
                                                    <span className="text-[10px] text-muted-foreground font-normal">(İsteğe bağlı)</span>
                                                )}
                                            </Label>
                                            
                                            {hasValues ? (
                                                <AttributeSearchableSelect
                                                    options={attr.attributeValues}
                                                    value={attrMappings[attrId]}
                                                    placeholder={`${attr.attribute.name} seçin veya arayın...`}
                                                    searchPlaceholder={`${attr.attribute.name} ara... (yazdıkça filtreler)`}
                                                    allowCustom={attr.allowCustom}
                                                    onValueChange={(val, option) => {
                                                        const num = Number(val);
                                                        const finalVal = isNaN(num) ? val : num;
                                                        
                                                        // Web Color seçildiğinde Renk alanını da otomatik senkronize et
                                                        if (attrId === 348 && option) {
                                                            setAttrMappings((prev: any) => ({
                                                                ...prev,
                                                                348: finalVal,
                                                                47: option.name
                                                            }));
                                                        } else {
                                                            setAttrMappings((prev: any) => ({ ...prev, [attrId]: finalVal }));
                                                        }
                                                    }}
                                                />
                                            ) : (
                                                <Input 
                                                    placeholder={attr.allowCustom ? "Değer girin..." : "Değer seçilemedi"} 
                                                    className="bg-white dark:bg-gray-800"
                                                    value={typeof attrMappings[attrId] === "string" ? attrMappings[attrId] : ""}
                                                    onChange={(e) => setAttrMappings((prev: any) => ({ ...prev, [attrId]: e.target.value }))}
                                                />
                                            )}
                                        </div>
                                    );
                                };

                                return (
                                    <>
                                        {/* Zorunlu Özellikler */}
                                        {requiredAttrs.length > 0 ? (
                                            <div className="space-y-3 p-4 rounded-2xl bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200/60 dark:border-orange-900/40">
                                                <div className="flex items-center gap-2 text-sm font-semibold text-orange-700 dark:text-orange-400">
                                                    <AlertCircle className="w-4 h-4" />
                                                    <span>Zorunlu Alanlar ({requiredAttrs.length} adet)</span>
                                                </div>
                                                <p className="text-[11px] text-orange-600/80 dark:text-orange-400/80 -mt-1">
                                                    Trendyol ürün onayının başarıyla tamamlanması için bu alanları seçiniz.
                                                </p>
                                                <div className="space-y-3 pt-1">
                                                    {requiredAttrs.map(renderField)}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-800 text-xs flex items-center gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                <span>Bu kategori için özel zorunlu alan bulunmamaktadır.</span>
                                            </div>
                                        )}

                                        {/* İsteğe Bağlı Özellikler (İthalatçı, Üretici vb.) */}
                                        {optionalAttrs.length > 0 && (
                                            <details className="group border border-gray-200 dark:border-gray-800 rounded-2xl p-3.5 bg-gray-50/50 dark:bg-gray-900/30">
                                                <summary className="cursor-pointer text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-between select-none">
                                                    <span className="flex items-center gap-1.5">
                                                        📋 İsteğe Bağlı Ek Bilgiler ({optionalAttrs.length} adet - İthalatçı vb.)
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                                                </summary>
                                                <p className="text-[11px] text-muted-foreground mt-2 mb-3">
                                                    Bu alanlar zorunlu değildir. Boş bırakırsanız ürününüz yine de sorunsuz olarak Trendyol'a iletilir.
                                                </p>
                                                <div className="space-y-3 pt-1">
                                                    {optionalAttrs.map(renderField)}
                                                </div>
                                            </details>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setShowAttrModal(false)}>İptal</Button>
                        <Button className="bg-orange-600 hover:bg-orange-700 text-white" onClick={handleSend} disabled={loadingProductId !== null}>
                            {loadingProductId ? "Gönderiliyor..." : "Verileri Gönder"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
