"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getTrendyolSellersProducts, importTrendyolProduct } from "./actions";
import { getCategories } from "@/app/admin/(protected)/categories/actions";
import { toast } from "sonner";
import { 
    Loader2, 
    Download, 
    CheckCircle2, 
    Link as LinkIcon, 
    Settings2, 
    Layers, 
    CheckSquare, 
    Square, 
    Zap,
    AlertCircle,
    ChevronRight,
    Search
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function TrendyolImportWizard() {
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<any[]>([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [importingId, setImportingId] = useState<string | null>(null);
    const [bulkImporting, setBulkImporting] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    
    // Config states
    const [siteCategories, setSiteCategories] = useState<any[]>([]);
    const [globalCategoryId, setGlobalCategoryId] = useState<string>("");
    const [discountRate, setDiscountRate] = useState<number>(20);

    // Selection states
    const [selectedBarcodes, setSelectedBarcodes] = useState<Set<string>>(new Set());
    const [rowCategoryIds, setRowCategoryIds] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchSiteCategories();
    }, []);

    const fetchSiteCategories = async () => {
        const cats = await getCategories();
        setSiteCategories(cats);
        if (cats.length > 0) setGlobalCategoryId(cats[0].id);
    };

    const fetchTrendyolProducts = async (isMore = false) => {
        setLoading(true);
        const nextPage = isMore ? page + 1 : 0;
        const res = await getTrendyolSellersProducts(nextPage, 50);
        
        if (res.success && res.data?.content) {
            const newItems = res.data.content;
            
            // Set default category for new products
            const newRowCats = { ...rowCategoryIds };
            newItems.forEach((p: any) => {
                if (!newRowCats[p.barcode]) {
                    newRowCats[p.barcode] = globalCategoryId;
                }
            });
            setRowCategoryIds(newRowCats);

            if (isMore) {
                setProducts(prev => [...prev, ...newItems]);
            } else {
                setProducts(newItems);
            }
            setPage(nextPage);
            setHasMore(newItems.length === 50);
            toast.success(`${newItems.length} ürün getirildi.`);
        } else {
            toast.error(res.message || "Ürünler çekilemedi.");
        }
        setLoading(false);
    };

    // When global category changes, update all row categories that haven't been touched?
    // Or just provide a "Apply to all" button. Let's do "Apply to all" or just update all for now for simplicity.
    const handleGlobalCategoryChange = (val: string) => {
        setGlobalCategoryId(val);
        const updated = { ...rowCategoryIds };
        products.forEach(p => {
            updated[p.barcode] = val;
        });
        setRowCategoryIds(updated);
    };

    const toggleSelectAll = () => {
        if (selectedBarcodes.size === products.length) {
            setSelectedBarcodes(new Set());
        } else {
            setSelectedBarcodes(new Set(products.map(p => p.barcode)));
        }
    };

    const toggleSelect = (barcode: string) => {
        const next = new Set(selectedBarcodes);
        if (next.has(barcode)) next.delete(barcode);
        else next.add(barcode);
        setSelectedBarcodes(next);
    };

    const handleImport = async (tProd: any) => {
        const categoryId = rowCategoryIds[tProd.barcode] || globalCategoryId;
        
        if (!categoryId) {
            toast.error("Lütfen önce bir hedef kategori seçin.");
            return;
        }

        setImportingId(tProd.barcode);
        try {
            const res = await importTrendyolProduct(tProductMapping(tProd), categoryId, discountRate);
            if (res.success) {
                toast.success(res.message);
                setProducts(prev => prev.map(p => p.barcode === tProd.barcode ? { ...p, isImported: true } : p));
                // Remove from selection if it was selected
                const nextSelected = new Set(selectedBarcodes);
                nextSelected.delete(tProd.barcode);
                setSelectedBarcodes(nextSelected);
            } else {
                toast.error(res.message);
            }
        } catch (error) {
            toast.error("İşlem başarısız.");
        }
        setImportingId(null);
    };

    const handleBulkImport = async () => {
        const selectedList = products.filter(p => selectedBarcodes.has(p.barcode) && !p.isImported);
        
        if (selectedList.length === 0) {
            toast.error("Lütfen aktarılacak ürünleri seçin.");
            return;
        }

        setBulkImporting(true);
        setProgress({ current: 0, total: selectedList.length });

        let successCount = 0;
        let failCount = 0;

        for (const p of selectedList) {
            const categoryId = rowCategoryIds[p.barcode] || globalCategoryId;
            try {
                const res = await importTrendyolProduct(tProductMapping(p), categoryId, discountRate);
                if (res.success) {
                    successCount++;
                    setProducts(prev => prev.map(item => item.barcode === p.barcode ? { ...item, isImported: true } : item));
                } else {
                    failCount++;
                }
            } catch (e) {
                failCount++;
            }
            setProgress(prev => ({ ...prev, current: prev.current + 1 }));
            // Small delay to prevent rate limit or UI freeze
            await new Promise(r => setTimeout(r, 100));
        }

        toast.success(`${successCount} ürün başarıyla aktarıldı.${failCount > 0 ? ` ${failCount} hata oluştu.` : ""}`);
        setSelectedBarcodes(new Set());
        setBulkImporting(false);
    };

    const tProductMapping = (t: any) => ({
        title: t.title,
        barcode: t.barcode,
        stockCode: t.stockCode,
        quantity: t.quantity,
        listPrice: t.listPrice,
        salePrice: t.salePrice,
        description: t.description,
        images: t.images,
        attributes: t.attributes,
        brand: t.brand
    });

    const isAllSelected = products.length > 0 && selectedBarcodes.size === products.length;

    return (
        <Card className="border-none shadow-xl overflow-hidden bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-2xl flex items-center gap-2">
                            <Zap className="w-6 h-6 fill-white" />
                            Trendyol Akıllı Ürün Sihirbazı
                        </CardTitle>
                        <CardDescription className="text-orange-100 mt-1">
                            Ürünleri toplu veya tekli olarak istediğiniz kategorilere saniyeler içinde aktarın.
                        </CardDescription>
                    </div>
                    {bulkImporting && (
                        <div className="bg-white/20 px-4 py-2 rounded-full flex items-center gap-3 animate-pulse">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm font-bold">
                                Aktarılıyor: {progress.current} / {progress.total}
                            </span>
                        </div>
                    )}
                </div>
            </CardHeader>
            
            <CardContent className="p-6 space-y-6">
                {/* QUICK SETTINGS BAR */}
                <div className="flex flex-wrap items-end gap-4 p-5 bg-gray-50 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex-1 min-w-[200px] space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 ml-1">
                            <Layers className="w-3 h-3" /> Varsayılan Kategori
                        </label>
                        <Select value={globalCategoryId} onValueChange={handleGlobalCategoryChange}>
                            <SelectTrigger className="h-11 bg-white border-gray-200 rounded-xl shadow-sm focus:ring-orange-500">
                                <SelectValue placeholder="Kategori Seçin" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                                {siteCategories.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="w-[140px] space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 ml-1">
                            💰 İndirim Oranı
                        </label>
                        <div className="relative">
                            <Input 
                                type="number" 
                                value={discountRate} 
                                onChange={(e) => setDiscountRate(Number(e.target.value))}
                                className="h-11 bg-white border-gray-200 rounded-xl shadow-sm pr-8 focus:ring-orange-500"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {!products.length ? (
                            <Button 
                                onClick={() => fetchTrendyolProducts(false)} 
                                disabled={loading} 
                                className="h-11 px-6 bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-lg shadow-orange-200 transition-all active:scale-95"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                                Ürünleri Listele
                            </Button>
                        ) : (
                            <Button 
                                onClick={handleBulkImport} 
                                disabled={bulkImporting || selectedBarcodes.size === 0}
                                className="h-11 px-6 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-lg shadow-green-200 transition-all active:scale-95 flex items-center gap-2"
                            >
                                {bulkImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                Seçili {selectedBarcodes.size} Ürünü Aktar
                            </Button>
                        )}
                    </div>
                </div>

                {!products.length ? (
                    <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-100 rounded-3xl bg-gray-50/30">
                        <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mb-4">
                            <Search className="w-10 h-10 text-orange-200" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-400">Henüz ürün listesi çekilmedi</h3>
                        <p className="text-sm text-gray-300 max-w-xs text-center mt-2">
                            Trendyol panelinizdeki ürünleri buraya çekmek için yukarıdaki butona tıklayın.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-4">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 cursor-pointer group" onClick={toggleSelectAll}>
                                    <div className={cn(
                                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                                        isAllSelected ? "bg-orange-500 border-orange-500" : "border-gray-200 group-hover:border-orange-300"
                                    )}>
                                        {isAllSelected && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                                    </div>
                                    <span className="text-sm font-bold text-gray-500">Tümünü Seç</span>
                                </div>
                                <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-100 rounded-lg px-3 py-1">
                                    {products.length} Ürün Bulundu
                                </Badge>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => fetchTrendyolProducts(false)} 
                                    disabled={loading} 
                                    className="text-xs text-gray-400 hover:text-orange-600"
                                >
                                    Listeyi Yenile
                                </Button>
                            </div>
                        </div>
                        
                        <div className="grid gap-3 max-h-[650px] overflow-y-auto pr-2 custom-scrollbar">
                            {products.map((p) => {
                                const tPrice = Number(p.salePrice || p.listPrice || 0);
                                const sPrice = (tPrice * (1 - discountRate / 100)).toFixed(2);
                                const isSelected = selectedBarcodes.has(p.barcode);
                                const isImported = p.isImported;
                                
                                return (
                                    <div 
                                        key={p.barcode} 
                                        className={cn(
                                            "group p-4 flex flex-col md:flex-row items-center gap-4 rounded-2xl border transition-all duration-200",
                                            isSelected ? "border-orange-200 bg-orange-50/30 ring-1 ring-orange-100" : "border-gray-100 bg-white hover:border-orange-100 hover:shadow-md",
                                            isImported && "opacity-80 grayscale-[0.5]"
                                        )}
                                    >
                                        <div className="flex items-center gap-4 w-full md:w-auto">
                                            <Checkbox 
                                                checked={isSelected} 
                                                onCheckedChange={() => toggleSelect(p.barcode)}
                                                disabled={isImported}
                                                className="w-5 h-5 border-gray-200 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                                            />
                                            
                                            <div className="relative w-16 h-16 shrink-0">
                                                {p.images?.[0]?.url ? (
                                                    <img src={p.images[0].url} alt="" className="w-full h-full object-cover rounded-xl border border-gray-100 bg-white" />
                                                ) : (
                                                    <div className="w-full h-full bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100">
                                                        <AlertCircle className="w-6 h-6 text-gray-200" />
                                                    </div>
                                                )}
                                                {isImported && (
                                                    <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1 shadow-lg">
                                                        <CheckCircle2 className="w-3 h-3" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-sm font-bold text-gray-700 line-clamp-1 group-hover:text-orange-600 transition-colors">
                                                        {p.title}
                                                    </h4>
                                                    {p.brand && (
                                                        <Badge variant="secondary" className="text-[9px] h-4 bg-gray-100 text-gray-500 border-none">
                                                            {typeof p.brand === 'string' ? p.brand : p.brand.name}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                                                    <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                                        {p.barcode}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-xs font-bold text-orange-600">{sPrice} TL</span>
                                                        <span className="text-[10px] text-gray-300 line-through">{tPrice} TL</span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-gray-400">{p.quantity} STOK</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 w-full md:w-auto md:ml-auto">
                                            <div className="flex-1 md:w-64">
                                                <Select 
                                                    value={rowCategoryIds[p.barcode] || globalCategoryId} 
                                                    onValueChange={(val) => setRowCategoryIds(prev => ({ ...prev, [p.barcode]: val }))}
                                                    disabled={isImported}
                                                >
                                                    <SelectTrigger className="h-9 text-xs bg-white/50 border-gray-100 rounded-lg">
                                                        <SelectValue placeholder="Kategori" />
                                                    </SelectTrigger>
                                                    <SelectContent className="max-h-[300px]">
                                                        {siteCategories.map(c => (
                                                            <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <Button 
                                                size="sm" 
                                                variant="ghost"
                                                className={cn(
                                                    "h-9 px-4 rounded-lg flex items-center gap-2 transition-all",
                                                    isImported 
                                                        ? "text-green-600 bg-green-50" 
                                                        : "text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                                                )}
                                                onClick={() => handleImport(p)}
                                                disabled={importingId === p.barcode || isImported || bulkImporting}
                                            >
                                                {importingId === p.barcode ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : isImported ? (
                                                    <CheckCircle2 className="w-4 h-4" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4" />
                                                )}
                                                <span className="hidden sm:inline">{isImported ? "Aktarıldı" : "Aktar"}</span>
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {hasMore && (
                            <Button 
                                variant="outline" 
                                className="w-full h-12 border-orange-100 text-orange-600 hover:bg-orange-50 rounded-2xl border-dashed" 
                                onClick={() => fetchTrendyolProducts(true)}
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Daha Fazla Ürün Yükle (Sonraki 50)"}
                            </Button>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
