
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
    History
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { sendProductToTrendyol, getTrendyolCategoryAttributes, enqueueTrendyolSync } from "../actions";
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

    const handleOpenWizard = async (product: any) => {
        const mappedCat = product.categories.find((c: any) => c.trendyolCategoryId !== null);
        if (!mappedCat) {
            toast.error("Önce kategoriyi Trendyol ile eşleştirmelisiniz.");
            return;
        }

        setSelectedProduct(product);
        setShowAttrModal(true);
        setAttrLoading(true);
        setAttrMappings({});

        try {
            const res = await getTrendyolCategoryAttributes(mappedCat.trendyolCategoryId);
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
            const res = await sendProductToTrendyol(selectedProduct.id, finalAttrs);
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

            <div className="bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-gray-50/50 dark:bg-gray-800/50">
                        <TableRow>
                            <TableHead className="w-[100px]">Görsel</TableHead>
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

                            return (
                                <TableRow key={product.id} className="hover:bg-orange-50/10 transition-colors">
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
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-1">
                                                {mappedCat ? (
                                                    <div className="flex flex-col">
                                                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 border-none text-[10px]">
                                                            {mappedCat.name}
                                                        </Badge>
                                                        <span className="text-[9px] text-muted-foreground font-mono mt-0.5">
                                                            Trendyol ID: #{mappedCat.trendyolCategoryId}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <Badge variant="outline" className="text-red-500 border-red-200 text-[10px]">
                                                        Kategori Eşleşmemiş
                                                    </Badge>
                                                )}
                                            </div>
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
                            Trendyol "{selectedProduct?.categories.find((c: any) => c.trendyolCategoryId)?.name}" kategorisi için zorunlu alanları doldurun.
                        </DialogDescription>
                    </DialogHeader>

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
