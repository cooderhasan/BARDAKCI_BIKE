
"use client";

import { useState } from "react";
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
    Box
} from "lucide-react";
import { toast } from "sonner";
import { sendProductToN11, getN11CategoryAttributes } from "../actions";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { N11TaskHistory } from "./n11-task-history";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { History, LayoutList } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Check, ChevronsUpDown, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface N11ProductListProps {
    initialProducts: any[];
}

export function N11ProductList({ initialProducts }: N11ProductListProps) {
    const [search, setSearch] = useState("");
    const [products, setProducts] = useState(initialProducts);
    const [loadingProductId, setLoadingProductId] = useState<string | null>(null);
    
    const [showAttrModal, setShowAttrModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [categoryAttrs, setCategoryAttrs] = useState<any[]>([]);
    const [attrMappings, setAttrMappings] = useState<any>({});
    const [attrLoading, setAttrLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState<{ [key: string]: string }>({});

    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku?.toLowerCase().includes(search.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(search.toLowerCase())
    );

    const handleOpenWizard = async (product: any) => {
        // Find N11 Category ID from product's categories
        const mappedCat = product.categories?.find((c: any) => c.n11CategoryId !== null);
        
        if (!mappedCat) {
            toast.error("Önce kategoriyi N11 ile eşleştirmelisiniz.");
            return;
        }

        setSelectedProduct(product);
        setCategoryAttrs([]); // Explicitly clear old attributes
        setAttrMappings({});
        setAttrLoading(true);
        setShowAttrModal(true);

        try {
            console.log("Fetching attrs for Cat ID:", mappedCat.n11CategoryId);
            const res = await getN11CategoryAttributes(mappedCat.n11CategoryId);
            
            if (res.success) {
                const attrs = res.data || [];
                console.log("Fetched attrs count:", attrs.length);
                setCategoryAttrs(attrs);
                if (attrs.length === 0) {
                    toast.info("Bu kategori için N11 tarafında özel bir özellik tanımlanmamış.");
                }
            } else {
                toast.error("N11 Veri Hatası: " + (res.message || "Bilinmeyen hata"));
            }
        } catch (error: any) {
            console.error("N11 handleOpenWizard Error:", error);
            toast.error("Sistem Hatası: Özellikler çekilirken bir problem oluştu.");
        } finally {
            setAttrLoading(false);
        }
    };

    const handleSend = async () => {
        if (!selectedProduct) return;
        
        // Check for mandatory attributes
        const missingMandatory = categoryAttrs.filter(attr => 
            attr.mandatory && !attrMappings[attr.id]
        );

        if (missingMandatory.length > 0) {
            toast.error(`Lütfen zorunlu alanları doldurun: ${missingMandatory.map(a => a.name).join(", ")}`);
            return;
        }

        const finalAttrs = Object.entries(attrMappings).map(([id, val]) => ({
            id: Number(id),
            value: val
        }));

        setLoadingProductId(selectedProduct.id);
        setShowAttrModal(false);

        try {
            const res = await sendProductToN11(selectedProduct.id, finalAttrs);
            if (res.success) {
                toast.success(res.message);
                setProducts(prev => prev.map(p => 
                    p.id === selectedProduct.id 
                    ? { ...p, n11Product: { isSynced: true, lastSyncedAt: new Date() } }
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
            const res = await sendProductToN11(product.id, []); 
            if (res.success) {
                toast.success("N11 Stok/Fiyat güncellendi.");
            } else {
                toast.error(res.message);
            }
        } catch (error) {
            toast.error("Güncelleme başarısız.");
        } finally {
            setLoadingProductId(null);
        }
    };

    return (
        <Tabs defaultValue="products" className="space-y-6">
            <TabsList className="bg-purple-50/50 dark:bg-purple-900/20 p-1 rounded-xl">
                <TabsTrigger value="products" className="rounded-lg gap-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                    <LayoutList className="w-4 h-4" />
                    Ürün Listesi
                </TabsTrigger>
                <TabsTrigger value="history" className="rounded-lg gap-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                    <History className="w-4 h-4" />
                    İşlem Geçmişi
                </TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="space-y-4">
                <div className="flex items-center gap-4 bg-white dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                            placeholder="N11 ürünlerini ara..." 
                            className="pl-10 border-none bg-gray-50 dark:bg-gray-800/50 focus-visible:ring-purple-500"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

            <div className="bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-gray-50/50 dark:bg-gray-800/50">
                        <TableRow>
                            <TableHead className="w-[80px]">Görsel</TableHead>
                            <TableHead>Ürün</TableHead>
                            <TableHead>Stok / N11 Fiyat</TableHead>
                            <TableHead>Eşleşme</TableHead>
                            <TableHead>Durum</TableHead>
                            <TableHead className="text-right">İşlem</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredProducts.map((product) => {
                            const isSynced = !!product.n11Product?.isSynced;
                            const mappedCat = product.categories.find((c: any) => c.n11CategoryId !== null);

                            return (
                                <TableRow key={product.id} className="hover:bg-purple-50/10 transition-colors">
                                    <TableCell>
                                        <img src={product.images?.[0]} className="w-12 h-12 object-cover rounded-lg border" />
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-sm line-clamp-1">{product.name}</span>
                                            <span className="text-[10px] text-muted-foreground font-mono">{product.sku || product.barcode}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold">{product.stock} Adet</span>
                                            <span className="text-sm text-purple-600 font-bold">
                                                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(product.n11Price || product.listPrice))}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {mappedCat ? (
                                            <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-none text-[10px]">
                                                Kategori OK
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-red-500 text-[10px]">Kategori Eksik</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {isSynced ? (
                                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                                        ) : (
                                            <AlertCircle className="w-4 h-4 text-amber-500" />
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            {isSynced ? (
                                                <>
                                                    <Button size="sm" variant="outline" title="Özellikleri Düzenle" className="h-8 w-8 p-0 border-purple-200 text-purple-600" onClick={() => handleOpenWizard(product)} disabled={loadingProductId === product.id}>
                                                        <Box className="w-3.5 h-3.5" />
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="h-8 border-purple-200 text-purple-600" onClick={() => handleQuickSync(product)} disabled={loadingProductId === product.id}>
                                                        <RefreshCcw className={`w-3 h-3 mr-1 ${loadingProductId === product.id ? 'animate-spin' : ''}`} />
                                                        Sync
                                                    </Button>
                                                </>
                                            ) : (
                                                <Button size="sm" className="h-8 bg-purple-600 hover:bg-purple-700 text-white" onClick={() => handleOpenWizard(product)} disabled={loadingProductId === product.id || !mappedCat}>
                                                    <Send className="w-3 h-3 mr-1" />
                                                    N11'e Gönder
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

            <Dialog open={showAttrModal} onOpenChange={setShowAttrModal}>
                <DialogContent className="sm:max-w-[700px] rounded-3xl border-purple-100 dark:border-purple-900/30 flex flex-col max-h-[90vh]">
                    <DialogHeader className="px-6 pt-6">
                        <DialogTitle>N11 Özelliklerini Eşleştir</DialogTitle>
                        <DialogDescription>Zorunlu alanları doldurarak ürünü N11'e kaydedin.</DialogDescription>
                    </DialogHeader>

                    {attrLoading ? (
                        <div className="py-20 flex justify-center"><RefreshCcw className="animate-spin text-purple-500 w-8 h-8" /></div>
                    ) : (
                        <div className="flex-1 overflow-y-auto px-6 py-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                                {categoryAttrs.map((attr: any, idx: number) => {
                                    const isMissing = attr.mandatory && !attrMappings[attr.id];
                                    const hasValues = attr.values && attr.values.length > 0;

                                    return (
                                        <div key={attr.id} className="space-y-1.5">
                                            {/* DEBUG: Raw data check */}
                                            {idx === 0 && (
                                                <div className="text-[10px] bg-yellow-50 p-1 rounded border border-yellow-200 mb-2 font-mono">
                                                    Ham Veri: {JSON.stringify(attr.values[0])}
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between">
                                                <Label className={`text-[11px] font-semibold ${isMissing ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
                                                    {attr.name} {attr.mandatory && <span className="text-red-500">*</span>}
                                                </Label>
                                                <span className="text-[9px] text-gray-400">{attr.values.length} seçenek</span>
                                            </div>
                                            
                                            {hasValues ? (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            className="w-full justify-between h-9 text-sm font-normal border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3"
                                                        >
                                                            <span className="truncate">
                                                                {attrMappings[attr.id] ? attrMappings[attr.id] : `${attr.name} seçin...`}
                                                            </span>
                                                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[400px] p-0 z-[110]" align="start">
                                                        <div className="flex flex-col h-[300px]">
                                                            <div className="p-2 border-b">
                                                                <Input 
                                                                    placeholder={`${attr.name} ara...`}
                                                                    className="h-8 text-xs"
                                                                    value={searchTerm[attr.id] || ""}
                                                                    onChange={(e) => {
                                                                        setSearchTerm(prev => ({ ...prev, [attr.id]: e.target.value }));
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
                                                                {attr.values
                                                                    .filter((v: any) => {
                                                                        const val = typeof v === 'object' ? (v?.attributeValue || v?.name || v?.value || String(v)) : String(v);
                                                                        const term = searchTerm[attr.id] || "";
                                                                        return val.toLocaleLowerCase('tr').includes(term.toLocaleLowerCase('tr'));
                                                                    })
                                                                    .map((v: any, idx: number) => {
                                                                    const val = typeof v === 'object' ? (v?.attributeValue || v?.name || v?.value || String(v)) : String(v);
                                                                    const isSelected = attrMappings[attr.id] === val;
                                                                    return (
                                                                        <div
                                                                            key={`${attr.id}-${idx}`}
                                                                            className={`flex items-center px-2 py-1.5 text-sm rounded-sm cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/20 ${isSelected ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600' : ''}`}
                                                                            onClick={() => {
                                                                                setAttrMappings((prev: any) => ({ ...prev, [attr.id]: val }));
                                                                            }}
                                                                        >
                                                                            <Check className={`mr-2 h-3.5 w-3.5 ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                                                                            <span className="truncate">{val}</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                                {attr.values.length === 0 && (
                                                                    <div className="p-4 text-center text-xs text-muted-foreground">Sonuç bulunamadı.</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            ) : (
                                                <Input 
                                                    className={`h-9 text-sm focus-visible:ring-purple-500 ${isMissing ? 'border-red-300 bg-red-50/50' : 'border-gray-200 dark:border-gray-800'}`}
                                                    placeholder={`${attr.name} girin...`}
                                                    value={attrMappings[attr.id] || ""}
                                                    onChange={(e) => setAttrMappings((prev: any) => ({ ...prev, [attr.id]: e.target.value }))}
                                                />
                                            )}
                                            
                                            {isMissing && <p className="text-[10px] text-red-500 font-medium">Bu alan zorunludur.</p>}
                                        </div>
                                    );
                                })}
                            </div>
                            {categoryAttrs.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground text-sm">Bu kategori için ek özellik bulunamadı.</div>
                            )}
                        </div>
                    )}

                    <DialogFooter className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-800">
                        <Button variant="ghost" onClick={() => setShowAttrModal(false)}>İptal</Button>
                        <Button className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-200 dark:shadow-none" onClick={handleSend}>Kaydet ve Gönder</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </TabsContent>

        <TabsContent value="history">
            <N11TaskHistory />
        </TabsContent>
    </Tabs>
);
}
