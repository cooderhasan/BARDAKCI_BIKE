
"use client";

import { useState, useEffect } from "react";
import { MarketplaceCategoryPicker } from "@/components/admin/marketplace-category-picker";
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
    Box,
    Tag,
    Edit3,
    Save,
    X,
    Plus
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { pickVariantValue, sameVariantValue } from "@/lib/variant-value-match";
import { getProductOperators } from "@/app/admin/(protected)/brands/actions";
import { operatorValueFor, pickProviderTypeValue } from "@/lib/operator-fields";
import { 
    sendProductToN11, 
    getN11CategoryAttributes, 
    enqueueN11Sync,
    setN11ProductCategory,
    setBulkN11ProductCategory,
    verifyN11Product
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
import { N11AttributeSearchSelect } from "./n11-attribute-search-select";

import { MarketplacePagination } from "@/components/admin/marketplace-pagination";

interface N11ProductListProps {
    initialProducts: any[];
    pagination?: {
        currentPage: number;
        totalPages: number;
        totalCount: number;
        limit: number;
    };
}

// --- Varyantlı ürün: N11'de her varyant kendi renk (isSlicer) / beden (isVariant) değeriyle gider ---
const n11Norm = (x: any) => String(x ?? "").toLocaleLowerCase("tr-TR").trim();
const isColorAttr = (a: any) => n11Norm(a.name).includes("renk") || n11Norm(a.name).includes("color");
/** Varyant bazında sorulacak özellikler */
function getN11VariantAttrs(attrs: any[]) {
    return attrs.filter((a: any) => a.isSlicer || a.isVariant);
}
/** Kategoride beden özelliği yoksa beden renk alanına yazılır ("Siyah / Mavi - M"), yoksa N11 aynı rengin bedenlerini ayıramaz */
function n11SizeGoesIntoColor(vAttrs: any[], vRows: any[]) {
    return !vAttrs.some((a: any) => !isColorAttr(a)) && vRows.some((v: any) => v.size);
}
const n11VariantLabel = (v: any) => [v.color, v.size].filter(Boolean).join(" / ") || v.barcode || v.sku;
/** Sitedeki renk / beden yazısını N11 değerine eşleştirir: listede varsa {id, name}, yoksa serbest metin */
function guessN11VariantValue(a: any, v: any, sizeInColor: boolean) {
    const color = isColorAttr(a);
    const src = color ? (sizeInColor ? [v.color, v.size].filter(Boolean).join(" - ") : v.color) : v.size;
    if (!src) return undefined;
    // Beden renge yazılıyorsa ("Siyah / Mavi - M") parçalı eşleştirme bedeni atardı; sadece birebir
    const hit = color && sizeInColor ? (a.values || []).find((x: any) => sameVariantValue(x.name, src)) : pickVariantValue<any>(a.values || [], src, (x) => x.name);
    if (hit) return { id: hit.id ?? null, name: hit.name };
    return a.isCustomValue || !(a.values || []).length ? { id: null, name: String(src) } : undefined;
}

export function N11ProductList({ initialProducts, pagination }: N11ProductListProps) {
    const [search, setSearch] = useState("");
    const [products, setProducts] = useState(initialProducts);

    useEffect(() => {
        setProducts(initialProducts);
    }, [initialProducts]);
    const [loadingProductId, setLoadingProductId] = useState<string | null>(null);
    const [verifyingId, setVerifyingId] = useState<string | null>(null);

    const handleVerify = async (productId: string) => {
        setVerifyingId(productId);
        try {
            const res = await verifyN11Product(productId);
            if (!res.success) {
                toast.error(res.message);
                return;
            }
            if (res.synced) toast.success(res.message);
            else toast.warning(res.message);
            setProducts(prev => prev.map(p =>
                p.id === productId
                    ? { ...p, n11Product: { ...(p.n11Product || {}), isSynced: res.synced, lastSyncError: res.synced ? null : res.message } }
                    : p
            ));
        } finally {
            setVerifyingId(null);
        }
    };
    const [syncing, setSyncing] = useState(false);

    const filteredProducts = pagination ? products : products.filter(p => 
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku?.toLowerCase().includes(search.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(search.toLowerCase())
    );
    
    const [showAttrModal, setShowAttrModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [categoryAttrs, setCategoryAttrs] = useState<any[]>([]);
    const [attrMappings, setAttrMappings] = useState<any>({});
    // Varyant ID -> { özellik ID -> {id, name} }
    const [variantMappings, setVariantMappings] = useState<Record<string, Record<string, any>>>({});
    const [attrLoading, setAttrLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState<{ [key: string]: string }>({});
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
            toast.error("Geçerli bir sayısal N11 Kategori ID girin.");
            setSavingCat(false);
            return;
        }
        const res = await setN11ProductCategory(productId, catNum);
        setSavingCat(false);
        if (res.success) {
            toast.success(res.message);
            setProducts((prev) =>
                prev.map((p) =>
                    p.id === productId
                        ? {
                              ...p,
                              n11Product: {
                                  ...(p.n11Product || {}),
                                  n11CategoryId: catNum,
                              },
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
            toast.warning("Lütfen geçerli bir N11 Kategori ID girin.");
            return;
        }
        setSavingCat(true);
        const res = await setBulkN11ProductCategory(selectedIds, catNum);
        setSavingCat(false);
        if (res.success) {
            toast.success(res.message);
            setProducts((prev) =>
                prev.map((p) =>
                    selectedIds.includes(p.id)
                        ? {
                              ...p,
                              n11Product: {
                                  ...(p.n11Product || {}),
                                  n11CategoryId: catNum,
                              },
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

    const handleOpenWizard = async (product: any) => {
        const productOverrideCatId = product.n11Product?.n11CategoryId;
        const mappedCat = product.categories?.find((c: any) => c.n11CategoryId !== null);
        const catId = productOverrideCatId || mappedCat?.n11CategoryId;
        
        if (!catId) {
            toast.error("Önce kategoriyi N11 ile eşleştirmelisiniz veya ürüne özel N11 Kategori ID girmelisiniz.");
            return;
        }

        setSelectedProduct(product);
        setCategoryAttrs([]); // Explicitly clear old attributes
        setAttrMappings({});
        setVariantMappings({});
        setAttrLoading(true);
        setShowAttrModal(true);

        try {
            console.log("Fetching attrs for Cat ID:", catId);
            const [res, ops] = await Promise.all([
                getN11CategoryAttributes(catId),
                getProductOperators(product.id).catch(() => null),
            ]);
            
            if (res.success) {
                const attrs = res.data || [];
                console.log("Fetched attrs count:", attrs.length);
                setCategoryAttrs(attrs);
                // Sağlayıcı Tipi + Kayıtlı Ticari Unvan / İletişim Adresi / E-posta: markadaki firmadan
                // (N11 tek firma istiyor: ithalatçı varsa o, yoksa imalatçı)
                const pre: any = {};
                for (const a of attrs as any[]) {
                    const nm = String(a.name || "");
                    if (Array.isArray(a.values) && a.values.length > 0) {
                        if (nm.toLocaleLowerCase("tr-TR").includes("sağlayıcı tipi")) {
                            const opts = a.values.map((x: any) => ({
                                id: typeof x === "object" ? x?.id || x?.attributeValueId || null : null,
                                name: String(typeof x === "object" ? x?.attributeValue || x?.name || x?.value || "" : x),
                            }));
                            const v = pickProviderTypeValue(opts, ops);
                            if (v) pre[a.id] = v;
                        }
                    } else {
                        const v = operatorValueFor(nm, ops, { singleFirm: true });
                        if (v) pre[a.id] = { id: null, name: v };
                    }
                }
                if (Object.keys(pre).length > 0) setAttrMappings(pre);

                // Varyantlar: renk / beden sitedeki yazıdan otomatik doldurulur
                const vRows = (product.variants || []).filter((v: any) => v.isActive !== false);
                const vAttrs = getN11VariantAttrs(attrs);
                if (vRows.length > 0 && vAttrs.length > 0) {
                    const sizeInColor = n11SizeGoesIntoColor(vAttrs, vRows);
                    const vMap: Record<string, Record<string, any>> = {};
                    for (const v of vRows) {
                        vMap[v.id] = {};
                        for (const a of vAttrs) {
                            const g = guessN11VariantValue(a, v, sizeInColor);
                            if (g) vMap[v.id][a.id] = g;
                        }
                    }
                    setVariantMappings(vMap);
                }
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
        
        // Varyantlı ürün: renk / beden varyant başına
        const vRows = (selectedProduct.variants || []).filter((v: any) => v.isActive !== false);
        const vAttrs = vRows.length > 0 ? getN11VariantAttrs(categoryAttrs) : [];
        const vAttrIds = new Set(vAttrs.map((a: any) => String(a.id)));
        let variantAttributes: Record<string, any[]> | undefined;
        if (vRows.length > 0 && vAttrs.length > 0) {
            const missing: string[] = [];
            variantAttributes = {};
            for (const v of vRows) {
                const m = variantMappings[v.id] || {};
                const list: any[] = [];
                for (const a of vAttrs) {
                    const val = m[a.id];
                    if (!val || !String(val.name || "").trim()) {
                        if (a.mandatory || a.isSlicer || a.isVariant) missing.push(`${n11VariantLabel(v)}: ${a.name}`);
                        continue;
                    }
                    list.push({ id: Number(a.id), valueId: val.id || null, customValue: val.id ? null : String(val.name).trim() });
                }
                variantAttributes[v.id] = list;
            }
            if (missing.length > 0) {
                toast.error(`Varyant değerleri eksik: ${missing.slice(0, 6).join(", ")}${missing.length > 6 ? " ..." : ""}`);
                return;
            }
            // Aynı renk + beden değerli iki varyant N11'de ayırt edilemez
            const seen = new Map<string, string>();
            const clashes: string[] = [];
            for (const v of vRows) {
                const key = vAttrs.map((a: any) => n11Norm(variantMappings[v.id]?.[a.id]?.name)).join("|");
                if (seen.has(key)) clashes.push(`${seen.get(key)} ve ${n11VariantLabel(v)}`);
                else seen.set(key, n11VariantLabel(v));
            }
            if (clashes.length > 0) {
                toast.error(`N11 bu varyantları ayırt edemez (renk/beden değerleri aynı): ${clashes.slice(0, 4).join("; ")}`, { duration: 12000 });
                return;
            }
        }

        // Check for mandatory attributes (varyant bazında sorulanlar hariç)
        const missingMandatory = categoryAttrs.filter(attr => 
            attr.mandatory && !vAttrIds.has(String(attr.id)) && !attrMappings[attr.id]
        );

        if (missingMandatory.length > 0) {
            toast.error(`Lütfen zorunlu alanları doldurun: ${missingMandatory.map(a => a.name).join(", ")}`);
            return;
        }

        // Akıllı Güvenlik/Üretici Bilgisi Kontrolü:
        // Eğer kullanıcı Kayıtlı Ticari Unvan veya İletişim Adresi girmişse, Sağlayıcı Tipi de seçilmelidir
        // Aksi takdirde N11 panelinde 'Üretici' mi yoksa 'İthalatçı' mı olduğu anlaşılamayıp alanlar boş kalır.
        const hasCompanyInfo = Object.entries(attrMappings).some(([id, val]: [string, any]) => {
            const attr = categoryAttrs.find((a: any) => String(a.id) === String(id));
            const name = (attr?.name || "").toLowerCase();
            return (name.includes("ticari unvan") || name.includes("ünvan") || name.includes("iletişim adresi")) && val?.name?.trim();
        });

        const providerAttr = categoryAttrs.find((a: any) => (a.name || "").toLowerCase().includes("sağlayıcı tipi"));
        if (hasCompanyInfo && providerAttr && !attrMappings[providerAttr.id]) {
            toast.warning("Kayıtlı Ticari Unvan girdiğinizde N11 panelinde 'Üretici' veya 'İthalatçı' kutusuna işlenebilmesi için 'Sağlayıcı Tipi' alanını da seçmelisiniz.");
            return;
        }

        const finalAttrs = Object.entries(attrMappings)
            .filter(([id]) => !vAttrIds.has(String(id)))
            .map(([id, val]: [string, any]) => ({
                id: Number(id),
                valueId: val.id || null,
                customValue: val.name || null
            }));

        setLoadingProductId(selectedProduct.id);
        setShowAttrModal(false);

        try {
            const res = await sendProductToN11(selectedProduct.id, finalAttrs, variantAttributes);
            if (res.success) {
                toast.success(res.message);
                // Ürün N11 kuyruğundaysa henüz onaylanmamıştır; yeşil tik sadece onaylanınca gösterilir
                setProducts(prev => prev.map(p => 
                    p.id === selectedProduct.id 
                    ? { ...p, n11Product: { ...(p.n11Product || {}), isSynced: !!res.synced, lastSyncedAt: new Date(), lastSyncError: res.synced ? null : "N11 onayı bekleniyor" } }
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

    const handleBulkSync = async () => {
        setSyncing(true);
        try {
            const res = await enqueueN11Sync();
            if (res.success) {
                toast.success(res.message, {
                    description: "N11 ürünleri arka planda güncelleniyor. Geçmiş sekmesinden takip edebilirsiniz.",
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
                {pagination ? (
                    <MarketplacePagination
                        currentPage={pagination.currentPage}
                        totalPages={pagination.totalPages}
                        totalCount={pagination.totalCount}
                        limit={pagination.limit}
                    />
                ) : null}

                <div className="flex flex-wrap justify-end gap-2 sm:gap-3">
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
                        className="border-purple-200 text-purple-600 hover:bg-purple-50 gap-2 h-10 px-4 rounded-xl shadow-sm transition-all active:scale-95"
                    >
                        {syncing ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                        <span className="hidden sm:inline">Tümünü Kuyrukta Güncelle</span>
                        <span className="sm:hidden">Toplu Güncelle</span>
                    </Button>

                    {pagination ? (
                        <Badge variant="outline" className="h-10 px-4 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/20 dark:text-purple-400 border-purple-100 dark:border-purple-900 font-bold">
                            TOPLAM {pagination.totalCount.toLocaleString("tr-TR")} ÜRÜN
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="h-10 px-4 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/20 dark:text-purple-400 border-purple-100 dark:border-purple-900 font-bold">
                            {initialProducts.length} ÜRÜN
                        </Badge>
                    )}
                </div>

            {/* Toplu Kategori Atama Paneli */}
            {bulkCatModalOpen && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 rounded-xl p-4 shadow-sm">
                    <Tag className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5 sm:mt-0" />
                    <div className="flex-1 space-y-1">
                        <p className="text-sm font-semibold text-purple-800 dark:text-purple-300">
                            Seçili {selectedIds.length} ürüne N11 Kategori ID ata
                        </p>
                        <p className="text-xs text-purple-600 dark:text-purple-400">
                            Bu ürünler site kategorisi yerine doğrudan belirlediğiniz N11 kategorisine gönderilecektir.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <MarketplaceCategoryPicker
                            marketplace="n11"
                            className="w-full sm:w-64"
                            onPick={(id, name) => { setBulkCatValue(id); toast.info(`Seçildi: ${name} (#${id}) — "Uygula"ya basın.`); }}
                        />
                        <Input
                            placeholder="N11 Kategori ID (örn: 100223)"
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
                            <TableHead>Ürün</TableHead>
                            <TableHead>Stok / N11 Fiyat</TableHead>
                            <TableHead>Kategori / Eşleşme</TableHead>
                            <TableHead>Durum</TableHead>
                            <TableHead className="text-right">İşlem</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredProducts.map((product) => {
                            const isSynced = !!product.n11Product?.isSynced;
                            const mappedCat = product.categories.find((c: any) => c.n11CategoryId !== null);
                            const hasCat = product.n11Product?.n11CategoryId || mappedCat;
                            const isSelected = selectedIds.includes(product.id);

                            return (
                                <TableRow key={product.id} className="hover:bg-purple-50/10 transition-colors">
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
                                        <img src={product.images?.[0]} className="w-12 h-12 object-cover rounded-lg border" />
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-sm line-clamp-1">{product.name}</span>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] text-muted-foreground font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{product.sku || product.barcode}</span>
                                                {product.n11Product?.sellerCode && (
                                                    <span className="text-[10px] font-mono text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.5 rounded font-semibold border border-purple-100 dark:border-purple-900" title="Entegra / N11 Stok Kodu">
                                                        N11: {product.n11Product.sellerCode}
                                                    </span>
                                                )}
                                                {product.n11Product?.n11Id && (
                                                    <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded" title="N11 İlan ID">
                                                        İlan #{product.n11Product.n11Id}
                                                    </span>
                                                )}
                                            </div>
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
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-1">
                                                {product.n11Product?.n11CategoryId ? (
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-1">
                                                            <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-950/40 dark:text-purple-300 border-purple-300 text-[10px] font-bold">
                                                                ⭐ Özel Kat: #{product.n11Product.n11CategoryId}
                                                            </Badge>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-5 w-5 text-muted-foreground hover:text-purple-600"
                                                                onClick={() => {
                                                                    setEditingCatId(product.id);
                                                                    setEditCatValue(String(product.n11Product.n11CategoryId));
                                                                }}
                                                                title="Özel kategoriyi düzenle / kaldır"
                                                            >
                                                                <Edit3 className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                        {mappedCat && (
                                                            <span className="text-[9px] text-muted-foreground line-through">
                                                                Eşleşen: #{mappedCat.n11CategoryId}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : mappedCat ? (
                                                    <div className="flex items-center gap-1">
                                                        <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-none text-[10px]">
                                                            Kategori OK (#{mappedCat.n11CategoryId})
                                                        </Badge>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-5 w-5 text-gray-400 hover:text-purple-600"
                                                            onClick={() => {
                                                                setEditingCatId(product.id);
                                                                setEditCatValue("");
                              }}
                                                            title="Bu ürüne özel N11 kategorisi ata"
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1">
                                                        <Badge variant="outline" className="text-red-500 text-[10px]">Kategori Eksik</Badge>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-5 w-5 text-purple-600 hover:bg-purple-50"
                                                            onClick={() => {
                                                                setEditingCatId(product.id);
                                                                setEditCatValue("");
                                                            }}
                                                            title="Bu ürüne özel N11 kategorisi ata"
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>

                                            {editingCatId === product.id && (
                                                <div className="flex items-center gap-1 p-1 bg-white dark:bg-gray-800 border border-purple-300 rounded-md shadow-sm z-10" onClick={(e) => e.stopPropagation()}>
                                                    {/* Adıyla arayıp seç: seçince hemen kaydedilir (alt kategori olmalı) */}
                                                    <MarketplaceCategoryPicker marketplace="n11" className="w-52" autoFocus onPick={(id) => handleSaveCatId(product.id, id)} />
                                                    <Input
                                                        type="number"
                                                        value={editCatValue}
                                                        onChange={(e) => setEditCatValue(e.target.value)}
                                                        placeholder="N11 Kat ID"
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
                                                    {product.n11Product?.n11CategoryId && (
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
                                    </TableCell>
                                    <TableCell>
                                        {isSynced ? (
                                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => handleVerify(product.id)}
                                                disabled={verifyingId === product.id}
                                                className="p-1 -m-1 rounded hover:bg-amber-50"
                                                title={`${product.n11Product?.lastSyncError || "N11'de senkron değil"} — N11'de kontrol etmek için tıklayın`}
                                            >
                                                {verifyingId === product.id
                                                    ? <RefreshCcw className="w-4 h-4 text-amber-500 animate-spin" />
                                                    : <AlertCircle className="w-4 h-4 text-amber-500" />}
                                            </button>
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
                                                <Button size="sm" className="h-8 bg-purple-600 hover:bg-purple-700 text-white" onClick={() => handleOpenWizard(product)} disabled={loadingProductId === product.id || !hasCat}>
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
                <DialogContent className="sm:max-w-[760px] w-[95vw] max-h-[88vh] flex flex-col p-0 overflow-hidden rounded-3xl border-purple-100 dark:border-purple-900/30 shadow-2xl">
                    <div className="p-6 pb-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                                <Box className="w-5 h-5 text-purple-600 shrink-0" />
                                N11 Özelliklerini Eşleştir
                            </DialogTitle>
                            <DialogDescription className="text-xs sm:text-sm text-muted-foreground truncate">
                                "{selectedProduct?.name}" ürünü için zorunlu alanları doldurarak N11'e kaydedin.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    {attrLoading ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-3">
                            <RefreshCcw className="animate-spin text-purple-600 w-8 h-8" />
                            <p className="text-xs text-muted-foreground animate-pulse">Özellikler yükleniyor...</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-4 min-w-0">
                            {(() => {
                                const vRows = (selectedProduct?.variants || []).filter((v: any) => v.isActive !== false);
                                if (vRows.length === 0) return null;
                                const vAttrs = getN11VariantAttrs(categoryAttrs);
                                return (
                                    <div className="space-y-2 p-3 rounded-xl bg-blue-50/60 border border-blue-200">
                                        <h4 className="text-xs font-bold text-blue-800">🎨 Varyantlar ({vRows.length}) — aynı model koduyla, her biri kendi renk/beden ve görselleriyle</h4>
                                        {vAttrs.length === 0 ? (
                                            <p className="text-[11px] text-red-600">Bu N11 kategorisinde renk/beden varyant özelliği yok; varyantlar N11'de seçenek olarak görünmez.</p>
                                        ) : n11SizeGoesIntoColor(vAttrs, vRows) ? (
                                            <p className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">Bu N11 kategorisinde beden özelliği yok; beden renk alanına yazıldı (ör. &quot;Siyah / Mavi - M&quot;).</p>
                                        ) : (
                                            <p className="text-[11px] text-blue-700/80">Değerler sitedeki renk/bedenden dolduruldu; boş kalanları seçin.</p>
                                        )}
                                        {vRows.map((v: any) => (
                                            <div key={v.id} className="rounded-lg border bg-white dark:bg-gray-950 p-2 space-y-2">
                                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                                    <span className="font-semibold">{n11VariantLabel(v)}</span>
                                                    <span className="font-mono text-[10px] text-gray-500">{v.sku || v.barcode}</span>
                                                    <span className="text-[10px] text-gray-500">{(v.images || []).length > 0 ? `${v.images.length} varyant görseli` : "ürünün görselleri"}</span>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {vAttrs.map((a: any) => {
                                                        const val = variantMappings[v.id]?.[a.id];
                                                        const setVal = (x: any) =>
                                                            setVariantMappings((prev) => {
                                                                const row = { ...(prev[v.id] || {}) };
                                                                if (x) row[a.id] = x; else delete row[a.id];
                                                                return { ...prev, [v.id]: row };
                                                            });
                                                        return (
                                                            <div key={a.id} className="space-y-1 min-w-0">
                                                                <Label className="text-[11px] font-semibold">
                                                                    {a.name}
                                                                    <span className="ml-1 text-[10px] font-normal text-gray-400">{a.isSlicer ? "(görselli seçenek)" : "(seçenek)"}</span>
                                                                </Label>
                                                                {a.values && a.values.length > 0 && !(isColorAttr(a) && n11SizeGoesIntoColor(vAttrs, vRows)) ? (
                                                                    <N11AttributeSearchSelect values={a.values} attrName={a.name} value={val} onValueChange={(x) => setVal(x)} isMissing={!val} />
                                                                ) : (
                                                                    <Input
                                                                        className="h-9 text-xs rounded-xl"
                                                                        placeholder={`${a.name} girin...`}
                                                                        value={val?.name || ""}
                                                                        onChange={(e) => setVal(e.target.value ? { id: null, name: e.target.value } : null)}
                                                                    />
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                                {categoryAttrs
                                    .filter((attr: any) => !((selectedProduct?.variants || []).some((v: any) => v.isActive !== false) && (attr.isSlicer || attr.isVariant)))
                                    .map((attr: any) => {
                                    const isMissing = attr.mandatory && !attrMappings[attr.id];
                                    const hasValues = attr.values && attr.values.length > 0;

                                    return (
                                        <div key={attr.id} className="space-y-1.5 min-w-0">
                                            <div className="flex items-center justify-between gap-1">
                                                <Label className={`text-xs font-semibold truncate ${isMissing ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
                                                    {attr.name} {attr.mandatory && <span className="text-red-500 font-bold">*</span>}
                                                </Label>
                                                <span className="text-[10px] text-gray-400 shrink-0">{attr.values?.length || 0} seçenek</span>
                                            </div>
                                            
                                            {hasValues ? (
                                                <N11AttributeSearchSelect
                                                    values={attr.values}
                                                    attrName={attr.name}
                                                    value={attrMappings[attr.id]}
                                                    onValueChange={(val) => {
                                                        if (val) {
                                                            setAttrMappings((prev: any) => ({ ...prev, [attr.id]: val }));
                                                        } else {
                                                            setAttrMappings((prev: any) => {
                                                                const next = { ...prev };
                                                                delete next[attr.id];
                                                                return next;
                                                            });
                                                        }
                                                    }}
                                                    isMissing={isMissing}
                                                />
                                            ) : (
                                                <Input 
                                                    className={`h-9 text-xs rounded-xl focus-visible:ring-purple-500 ${isMissing ? 'border-red-300 bg-red-50/50' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950'}`}
                                                    placeholder={`${attr.name} girin...`}
                                                    value={attrMappings[attr.id]?.name || ""}
                                                    onChange={(e) => setAttrMappings((prev: any) => ({ ...prev, [attr.id]: { id: null, name: e.target.value } }))}
                                                />
                                            )}
                                            
                                            {isMissing && <p className="text-[10px] text-red-500 font-medium">Bu alan zorunludur.</p>}
                                        </div>
                                    );
                                })}
                            </div>
                            {categoryAttrs.length === 0 && (
                                <div className="text-center py-12 text-muted-foreground text-xs">
                                    Bu kategori için N11 tarafında özel bir zorunlu özellik bulunamadı.
                                </div>
                            )}
                        </div>
                    )}

                    <div className="p-4 px-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/60 shrink-0 flex items-center justify-end gap-2">
                        <Button variant="ghost" onClick={() => setShowAttrModal(false)}>İptal</Button>
                        <Button 
                            className="bg-purple-600 hover:bg-purple-700 text-white font-medium shadow-sm" 
                            onClick={handleSend}
                            disabled={loadingProductId !== null}
                        >
                            {loadingProductId ? "Gönderiliyor..." : "Kaydet ve Gönder"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </TabsContent>

        <TabsContent value="history">
            <N11TaskHistory />
        </TabsContent>
    </Tabs>
);
}
