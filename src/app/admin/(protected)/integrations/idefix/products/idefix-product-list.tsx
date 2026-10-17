
"use client";

import { useState, useEffect } from "react";
import { MarketplaceCategoryPicker } from "@/components/admin/marketplace-category-picker";
import { SearchablePicker } from "@/components/ui/searchable-picker";
import { useRouter } from "next/navigation";
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
  Tag,
  Edit3,
  Save,
  X,
  Plus,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { pickVariantValue, sameVariantValue } from "@/lib/variant-value-match";
import { getProductOperators } from "@/app/admin/(protected)/brands/actions";
import { operatorLine } from "@/lib/operator-fields";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  syncProductsToIdefix,
  updateIdefixStockPrice,
  matchIdefixProducts,
  enqueueIdefixSync,
  toggleIdefixProductActive,
  createProductOnIdefix,
  getIdefixCategoryAttributes,
  getIdefixAddressesAndCargo,
  checkIdefixBatchStatus,
  setIdefixProductCategory,
  setBulkIdefixProductCategory,
} from "../actions";

import { MarketplacePagination } from "@/components/admin/marketplace-pagination";

interface IdefixProductListProps {
  initialProducts: any[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
  };
}

// --- Idefix kategori özellikleri + varyantlar (isSlicer / isVariant) ---
const idxNorm = (x: any) => String(x ?? "").toLocaleLowerCase("tr-TR").trim();
const idxIsColor = (a: any) => /renk|color/.test(idxNorm(a.name));
const idxVariantLabel = (v: any) => [v.color, v.size].filter(Boolean).join(" / ") || v.barcode;
/** Kategoride beden (renk dışı varyant özelliği) yoksa beden renk alanına yazılır */
function idxSizeIntoColor(vAttrs: any[], vRows: any[]) {
  return !vAttrs.some((a: any) => !idxIsColor(a)) && vRows.some((v: any) => v.size);
}
function idxGuess(a: any, v: any, sizeInColor: boolean) {
  const color = idxIsColor(a);
  const src = color ? (sizeInColor ? [v.color, v.size].filter(Boolean).join(" - ") : v.color) : v.size;
  if (!src) return undefined;
  // Beden renge yazılıyorsa ("Siyah / Mavi - M") parçalı eşleştirme bedeni atardı; sadece birebir
  const hit = color && sizeInColor ? (a.values || []).find((x: any) => sameVariantValue(x.name, src)) : pickVariantValue<any>(a.values || [], src, (x) => x.name);
  if (hit) return { id: hit.id, name: hit.name };
  return a.allowCustom || (a.values || []).length === 0 ? { id: null, name: String(src) } : undefined;
}
/** Tek özellik alanı: listede değer varsa aranabilir seçim, yoksa serbest metin */
function IdefixAttrInput({ attr, value, onChange }: { attr: any; value: any; onChange: (v: any) => void }) {
  const values = attr.values || [];
  if (values.length > 0 && !(attr.allowCustom && value && !value.id)) {
    return (
      <SearchablePicker
        options={values.map((x: any) => x.name)}
        value={value?.name || ""}
        onValueChange={(name: string) => {
          const hit = values.find((x: any) => x.name === name);
          onChange(hit ? { id: hit.id, name: hit.name } : null);
        }}
        placeholder={`${attr.name} seçin...`}
        searchPlaceholder={`${attr.name} ara...`}
        title={attr.name}
        className="h-8 text-xs"
      />
    );
  }
  return (
    <Input
      className="h-8 text-xs"
      placeholder={`${attr.name} girin...`}
      value={value?.name || ""}
      onChange={(e) => onChange(e.target.value ? { id: null, name: e.target.value } : null)}
    />
  );
}

export function IdefixProductList({ initialProducts, pagination }: IdefixProductListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState(initialProducts);

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);
  const [checkingBatchId, setCheckingBatchId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const filteredProducts = pagination ? products : products.filter(
    (p) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()) ||
      p.brand?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCheckBatchStatus = async (productId: string) => {
    setCheckingBatchId(productId);
    try {
      const res = await checkIdefixBatchStatus(productId);
      if (res.success) {
        toast.success(res.message, { duration: 6000 });
      } else {
        toast.error(res.message, { duration: 6000 });
      }
    } catch {
      toast.error("Batch sorgulanırken hata oluştu.");
    } finally {
      setCheckingBatchId(null);
    }
  };

  // Send Modal States
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [sendType, setSendType] = useState<"quick" | "create">("quick");
  const [idefixCategoryId, setIdefixCategoryId] = useState("");
  const [idefixBrandId, setIdefixBrandId] = useState("");
  const [manufacturer, setManufacturer] = useState("Bardakcı Bike");
  const [importer, setImporter] = useState("Bardakcı Bike");
  const [sendingModal, setSendingModal] = useState(false);
  // Kategori özellikleri ve varyant değerleri (Sıfırdan Ürün Oluştur)
  const [idxAttrs, setIdxAttrs] = useState<any[]>([]);
  const [idxAttrLoading, setIdxAttrLoading] = useState(false);
  const [idxAttrValues, setIdxAttrValues] = useState<Record<string, any>>({});
  const [idxVariantValues, setIdxVariantValues] = useState<Record<string, Record<string, any>>>({});

  const loadIdefixAttrs = async (catId: string, product: any) => {
    setIdxAttrs([]);
    setIdxAttrValues({});
    setIdxVariantValues({});
    if (!catId) return;
    setIdxAttrLoading(true);
    try {
      const res: any = await getIdefixCategoryAttributes(catId);
      if (!res.success) {
        toast.warning(res.message || "Idefix kategori özellikleri alınamadı.");
        return;
      }
      const attrs = res.data || [];
      setIdxAttrs(attrs);
      const vRows = (product?.variants || []).filter((v: any) => v.isActive !== false && v.barcode);
      const vAttrs = attrs.filter((a: any) => a.isVariant || a.isSlicer);
      if (vRows.length > 0 && vAttrs.length > 0) {
        const sizeInColor = idxSizeIntoColor(vAttrs, vRows);
        const m: Record<string, Record<string, any>> = {};
        for (const v of vRows) {
          m[v.id] = {};
          for (const a of vAttrs) {
            const g = idxGuess(a, v, sizeInColor);
            if (g) m[v.id][a.id] = g;
          }
        }
        setIdxVariantValues(m);
      }
    } finally {
      setIdxAttrLoading(false);
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
    const catStr = targetVal.trim() || null;
    const res = await setIdefixProductCategory(productId, catStr);
    setSavingCat(false);
    if (res.success) {
      toast.success(res.message);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? {
                ...p,
                idefixProduct: {
                  ...(p.idefixProduct || {}),
                  idefixCategoryId: catStr,
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
    if (!bulkCatValue.trim()) {
      toast.warning("Lütfen geçerli bir Idefix Kategori ID girin.");
      return;
    }
    setSavingCat(true);
    const res = await setBulkIdefixProductCategory(selectedIds, bulkCatValue.trim());
    setSavingCat(false);
    if (res.success) {
      toast.success(res.message);
      setProducts((prev) =>
        prev.map((p) =>
          selectedIds.includes(p.id)
            ? {
                ...p,
                idefixProduct: {
                  ...(p.idefixProduct || {}),
                  idefixCategoryId: bulkCatValue.trim(),
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

  const openSendModal = (product: any) => {
    const count = getBarcodeCount(product);
    if (count === 0) {
      toast.error("Ürünün veya varyantlarının barkodu bulunamadı. Lütfen ürün düzenleme sayfasından barkod ekleyin.");
      return;
    }

    setSelectedProduct(product);
    const mappedCat = product.categories?.find((c: any) => c.idefixCategoryId);
    const catId = product.idefixProduct?.idefixCategoryId || mappedCat?.idefixCategoryId || "";
    setIdefixCategoryId(catId);
    setIdefixBrandId(product.brand?.idefixBrandId || "");
    setManufacturer(product.brand?.name || "Bardakcı Bike");
    setImporter("Bardakcı Bike");
    setModalOpen(true);
    loadIdefixAttrs(String(catId || ""), product);
    // Markaya imalatçı / ithalatçı firması tanımlıysa onların bilgisi yazılır (tanımlı değilse eski varsayılan kalır)
    getProductOperators(product.id)
      .then((ops) => {
        if (ops?.manufacturer) setManufacturer(operatorLine(ops.manufacturer));
        if (ops?.importer) setImporter(operatorLine(ops.importer));
      })
      .catch(() => {});
  };

  const handleModalSubmit = async () => {
    if (!selectedProduct) return;
    setSendingModal(true);

    try {
      if (sendType === "quick") {
        const res = await syncProductsToIdefix([selectedProduct.id], { activate: true });
        if (res.success) {
          toast.success(res.message);
          setModalOpen(false);
        } else {
          toast.error(res.message);
        }
      } else {
        if (!idefixCategoryId || !idefixBrandId) {
          toast.error("Yeni ürün oluşturmak için Idefix Kategori ID ve Marka ID zorunludur.");
          setSendingModal(false);
          return;
        }

        // Kategori özellikleri + varyant değerleri
        const vRows = (selectedProduct.variants || []).filter((v: any) => v.isActive !== false && v.barcode);
        const vAttrs = vRows.length > 0 ? idxAttrs.filter((a: any) => a.isVariant || a.isSlicer) : [];
        const vAttrIds = new Set(vAttrs.map((a: any) => String(a.id)));
        const missingReq = idxAttrs.filter((a: any) => a.required && !vAttrIds.has(String(a.id)) && !idxAttrValues[a.id]);
        if (missingReq.length > 0) {
          toast.error(`Zorunlu özellikler eksik: ${missingReq.map((a: any) => a.name).join(", ")}`);
          setSendingModal(false);
          return;
        }
        const toAttr = (attrId: any, val: any) => ({
          attributeId: Number(attrId),
          attributeValueId: val?.id ? Number(val.id) : null,
          customAttributeValue: val?.id ? null : String(val?.name || "").trim() || null,
        });
        const attributes = Object.entries(idxAttrValues)
          .filter(([id, val]) => val && !vAttrIds.has(String(id)))
          .map(([id, val]) => toAttr(id, val));
        let variantAttributes: Record<string, any[]> | undefined;
        if (vRows.length > 0 && vAttrs.length > 0) {
          variantAttributes = {};
          const missing: string[] = [];
          const seen = new Map<string, string>();
          const clashes: string[] = [];
          for (const v of vRows) {
            const m = idxVariantValues[v.id] || {};
            const list: any[] = [];
            for (const a of vAttrs) {
              if (!m[a.id]) { missing.push(`${idxVariantLabel(v)}: ${a.name}`); continue; }
              list.push(toAttr(a.id, m[a.id]));
            }
            variantAttributes[v.id] = list;
            const key = vAttrs.map((a: any) => idxNorm(m[a.id]?.name)).join("|");
            if (seen.has(key)) clashes.push(`${seen.get(key)} ve ${idxVariantLabel(v)}`);
            else seen.set(key, idxVariantLabel(v));
          }
          if (missing.length > 0) {
            toast.error(`Varyant değerleri eksik: ${missing.slice(0, 6).join(", ")}`);
            setSendingModal(false);
            return;
          }
          if (clashes.length > 0) {
            toast.error(`Idefix bu varyantları ayırt edemez (değerler aynı): ${clashes.slice(0, 4).join("; ")}`, { duration: 12000 });
            setSendingModal(false);
            return;
          }
        }

        const res = await createProductOnIdefix(selectedProduct.id, {
          idefixCategoryId,
          idefixBrandId,
          manufacturer,
          importer,
          attributes,
          variantAttributes,
        });

        if (res.success) {
          toast.success(res.message);
          setProducts((prev) =>
            prev.map((p) => {
              if (p.id === selectedProduct.id) {
                const updatedCats = (p.categories || []).map((c: any, idx: number) =>
                  idx === 0 ? { ...c, idefixCategoryId: String(idefixCategoryId) } : c
                );
                if (updatedCats.length === 0) {
                  updatedCats.push({ id: 'temp', name: 'Kategori', idefixCategoryId: String(idefixCategoryId) });
                }
                const updatedBrand = p.brand ? { ...p.brand, idefixBrandId: String(idefixBrandId) } : { id: 'temp', name: 'Marka', idefixBrandId: String(idefixBrandId) };
                return {
                  ...p,
                  categories: updatedCats,
                  brand: updatedBrand,
                };
              }
              return p;
            })
          );
          setModalOpen(false);
        } else {
          toast.error(res.message);
        }
      }
    } catch {
      toast.error("Gönderim sırasında hata oluştu.");
    } finally {
      setSendingModal(false);
    }
  };

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

  const [stockUpdatingId, setStockUpdatingId] = useState<string | null>(null);
  const [matchingIdefix, setMatchingIdefix] = useState(false);

  // Idefix'te olup listede senkronize görünmeyen ürünleri barkodla eşleştirir
  const handleMatchIdefix = async () => {
    if (!confirm("Idefix'teki tüm ürünler çekilip barkodu eşleşen ürünler 'Senkronize' işaretlenecek. Bu işlem 1-2 dakika sürebilir. Devam edilsin mi?")) return;
    setMatchingIdefix(true);
    try {
      const res = await matchIdefixProducts();
      if (res.success) { toast.success(res.message, { duration: 60000 }); router.refresh(); }
      else toast.error(res.message);
    } finally {
      setMatchingIdefix(false);
    }
  };

  // Sadece stok/fiyat gönderir (yeni ürün yüklemez); onay sonrası stok 0 kalan ürünler için
  const handleStockPriceUpdate = async (productId: string) => {
    setStockUpdatingId(productId);
    try {
      const res = await updateIdefixStockPrice(productId);
      if (res.success) toast.success("Stok/fiyat Idefix'e gönderildi", { description: res.message, duration: 10000 });
      else toast.error(res.message, { duration: 15000 });
    } catch {
      toast.error("Bir hata oluştu.");
    } finally {
      setStockUpdatingId(null);
    }
  };

  const handleSingleSync = async (productId: string) => {
    setLoadingProductId(productId);
    try {
      const res = await syncProductsToIdefix([productId], { activate: true });
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
      {pagination ? (
        <MarketplacePagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalCount={pagination.totalCount}
          limit={pagination.limit}
        />
      ) : null}

      {/* Ozet */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Toplam Urun</p>
          <p className="text-2xl font-bold">{pagination ? pagination.totalCount.toLocaleString("tr-TR") : products.length}</p>
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

      {/* Toplu Islemler */}
      <div className="flex justify-end gap-3 flex-wrap">
        <Button
          variant="outline"
          onClick={() => setBulkCatModalOpen(!bulkCatModalOpen)}
          disabled={selectedIds.length === 0}
          className="border-purple-200 text-purple-700 hover:bg-purple-50 gap-2"
        >
          <Tag className="w-4 h-4 text-purple-600" />
          <span>Toplu Kategori Ata ({selectedIds.length})</span>
        </Button>

        <Button
          variant="outline"
          onClick={handleMatchIdefix}
          disabled={matchingIdefix}
          className="border-purple-200 text-purple-700 hover:bg-purple-50 gap-2"
          title="Idefix'te olup listede senkronize görünmeyen ürünleri barkodla eşleştirir"
        >
          <RefreshCcw className={`w-4 h-4 ${matchingIdefix ? "animate-spin" : ""}`} />
          {matchingIdefix ? "Eşleştiriliyor..." : "Idefix ile Eşleştir"}
        </Button>

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

      {/* Toplu Kategori Atama Paneli */}
      {bulkCatModalOpen && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 rounded-xl p-4 shadow-sm">
          <Tag className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5 sm:mt-0" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-semibold text-purple-800 dark:text-purple-300">
              Seçili {selectedIds.length} ürüne Idefix Kategori ID ata
            </p>
            <p className="text-xs text-purple-600 dark:text-purple-400">
              Bu ürünler site kategorisi yerine doğrudan belirlediğiniz Idefix kategorisine gönderilecektir.
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <MarketplaceCategoryPicker
                marketplace="idefix"
                className="w-full sm:w-64"
                onPick={(id, name) => { setBulkCatValue(id); toast.info(`Seçildi: ${name} (#${id}) — "Uygula"ya basın.`); }}
            />
            <Input
              placeholder="Idefix Kategori ID (örn: 12345)"
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

      {/* Tablo */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
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
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Urun bulunamadi.
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => {
                const barcodeCount = getBarcodeCount(product);
                const hasBarcode = barcodeCount > 0;
                const isSending = loadingProductId === product.id;
                const isToggling = toggling === product.id;
                const isSelected = selectedIds.includes(product.id);
                const mappedCat = product.categories?.find((c: any) => c.idefixCategoryId);

                return (
                  <TableRow key={product.id} className={product.isIdefixActive ? "bg-purple-50/30" : ""}>
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
                      <div>
                        <p className="font-medium text-sm line-clamp-1">{product.name}</p>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span className="text-xs text-muted-foreground font-mono">{product.sku}</span>
                          {product.idefixProduct?.idefixCategoryId ? (
                            <span className="inline-flex items-center gap-1">
                              <Badge className="bg-purple-100 text-purple-800 text-[10px] font-bold py-0 px-1.5 border-purple-200">
                                ⭐ Özel Kat: #{product.idefixProduct.idefixCategoryId}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 text-muted-foreground hover:text-purple-600"
                                onClick={() => {
                                  setEditingCatId(product.id);
                                  setEditCatValue(product.idefixProduct.idefixCategoryId);
                                }}
                                title="Özel kategoriyi düzenle / kaldır"
                              >
                                <Edit3 className="w-2.5 h-2.5" />
                              </Button>
                            </span>
                          ) : mappedCat?.idefixCategoryId ? (
                            <span className="inline-flex items-center gap-1">
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-purple-700 border-purple-200">
                                Kat: #{mappedCat.idefixCategoryId}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 text-gray-400 hover:text-purple-600"
                                onClick={() => {
                                  setEditingCatId(product.id);
                                  setEditCatValue("");
                                }}
                                title="Bu ürüne özel Idefix kategorisi ata"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </Button>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <Badge variant="outline" className="text-[10px] text-gray-400 border-dashed py-0 px-1.5">
                                Kat: Tanımsız
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 text-purple-600 hover:bg-purple-50"
                                onClick={() => {
                                  setEditingCatId(product.id);
                                  setEditCatValue("");
                                }}
                                title="Bu ürüne özel Idefix kategorisi ata"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </Button>
                            </span>
                          )}
                        </div>

                        {editingCatId === product.id && (
                          <div className="flex items-center gap-1 p-1 bg-white dark:bg-gray-800 border border-purple-300 rounded-md shadow-sm z-10 w-fit mt-1" onClick={(e) => e.stopPropagation()}>
                            {/* Adıyla arayıp seç: seçince hemen kaydedilir (alt kategori olmalı) */}
                            <MarketplaceCategoryPicker marketplace="idefix" className="w-52" autoFocus onPick={(id) => handleSaveCatId(product.id, id)} />
                            <Input
                              value={editCatValue}
                              onChange={(e) => setEditCatValue(e.target.value)}
                              placeholder="Idefix Kat ID"
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
                            {product.idefixProduct?.idefixCategoryId && (
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
                        <p className="text-xs text-red-500 mt-1 max-w-[150px] truncate" title={product.idefixProduct.lastSyncError}>
                          {product.idefixProduct.lastSyncError}
                        </p>
                      )}
                      {product.idefixProduct?.batchId && (
                        <button
                          type="button"
                          onClick={() => handleCheckBatchStatus(product.id)}
                          disabled={checkingBatchId === product.id}
                          className="block mx-auto text-[10px] text-purple-600 underline hover:text-purple-800 mt-1 font-medium"
                        >
                          {checkingBatchId === product.id ? "Sorgulanıyor..." : "🔍 Durum Sorgula"}
                        </button>
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
                      <div className="flex items-center justify-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={stockUpdatingId === product.id}
                        onClick={() => handleStockPriceUpdate(product.id)}
                        className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 gap-1.5"
                        title="Sadece güncel stok ve fiyatı Idefix'e gönderir"
                      >
                        <RefreshCcw className={`w-3 h-3 ${stockUpdatingId === product.id ? "animate-spin" : ""}`} />
                        Stok/Fiyat
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isSending}
                        onClick={() => openSendModal(product)}
                        className="border-purple-200 text-purple-700 hover:bg-purple-50 gap-1.5"
                      >
                        {isSending ? (
                          <RefreshCcw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Send className="w-3 h-3" />
                        )}
                        {isSending ? "Gonderiliyor" : "Gonder"}
                      </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* --- IDEFIX GÖNDERİM MODALI --- */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-800 dark:text-purple-300">
              <Send className="w-5 h-5 text-purple-600" />
              Idefix'e Ürün Gönder
            </DialogTitle>
            <DialogDescription>
              {selectedProduct?.name} ({selectedProduct?.sku || selectedProduct?.barcode})
            </DialogDescription>
          </DialogHeader>

          <Tabs value={sendType} onValueChange={(val) => setSendType(val as any)} className="w-full">
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="quick">⚡ Hızlı Yükleme (Fast Listing)</TabsTrigger>
              <TabsTrigger value="create">📝 Sıfırdan Ürün Oluştur (Create)</TabsTrigger>
            </TabsList>

            <TabsContent value="quick" className="space-y-3">
              <div className="p-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 rounded-lg text-xs text-purple-800 dark:text-purple-300 space-y-1">
                <p className="font-semibold">⚡ Hızlı Ürün Yükleme Yöntemi:</p>
                <p>Ürününüzün barkodu Idefix kataloğunda zaten varsa, Kategori ve Marka eşleştirmesine gerek kalmadan saniyeler içinde satışa açılır ve stok/fiyat güncellenir.</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border">
                <div>
                  <span className="text-gray-500 block">Gönderilecek Fiyat:</span>
                  <span className="font-bold text-sm text-purple-700">
                    ₺{Number(selectedProduct?.idefixPrice ?? selectedProduct?.salePrice ?? selectedProduct?.listPrice).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block">Mevcut Stok:</span>
                  <span className="font-bold text-sm">{selectedProduct?.stock ?? 0} adet</span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="create" className="space-y-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-lg text-xs text-amber-800 dark:text-amber-300">
                <p className="font-semibold">📝 Yeni Ürün Oluşturma Yöntemi:</p>
                <p>Ürününüz Idefix kataloğunda henüz yoksa, Idefix Kategori ID, Marka ID ve İmalatçı bilgilerinizle Idefix ürün havuzuna eklenir.</p>
              </div>

              <div className="grid gap-3">
                <div className="space-y-1">
                  <Label htmlFor="modalCatId" className="text-xs">Idefix Kategori ID *</Label>
                  <Input
                    id="modalCatId"
                    value={idefixCategoryId}
                    onChange={(e) => setIdefixCategoryId(e.target.value)}
                    placeholder="Örn: 15031706 (Kategoriler sayfasından eşleştirebilirsiniz)"
                    className="h-9 text-xs"
                  />
                  <button
                    type="button"
                    className="text-[11px] text-purple-700 underline hover:text-purple-900"
                    onClick={() => loadIdefixAttrs(idefixCategoryId, selectedProduct)}
                  >
                    Bu kategorinin özelliklerini yükle
                  </button>
                  {idefixCategoryId ? (
                    <p className="text-[10px] text-green-600 font-medium">✓ Kategori ID tanımlı</p>
                  ) : (
                    <p className="text-[10px] text-amber-600">Kategori ID boş. Lütfen Kategoriler sayfasından eşleştirin veya manuel girin.</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="modalBrandId" className="text-xs">Idefix Marka ID *</Label>
                  <Input
                    id="modalBrandId"
                    value={idefixBrandId}
                    onChange={(e) => setIdefixBrandId(e.target.value)}
                    placeholder="Örn: 3573 (Markalar sayfasından eşleştirebilirsiniz)"
                    className="h-9 text-xs"
                  />
                  {idefixBrandId ? (
                    <p className="text-[10px] text-green-600 font-medium">✓ Marka ID tanımlı</p>
                  ) : (
                    <p className="text-[10px] text-amber-600">Marka ID boş. Lütfen Markalar sayfasından eşleştirin veya manuel girin.</p>
                  )}
                </div>

                {/* Kategori özellikleri ve varyantlar */}
                {idxAttrLoading ? (
                  <p className="text-xs text-purple-700">Kategori özellikleri yükleniyor...</p>
                ) : idxAttrs.length > 0 && (() => {
                  const vRows = (selectedProduct?.variants || []).filter((v: any) => v.isActive !== false && v.barcode);
                  const vAttrs = vRows.length > 0 ? idxAttrs.filter((a: any) => a.isVariant || a.isSlicer) : [];
                  const vAttrIds = new Set(vAttrs.map((a: any) => a.id));
                  const others = idxAttrs.filter((a: any) => !vAttrIds.has(a.id));
                  const reqs = others.filter((a: any) => a.required);
                  const opts = others.filter((a: any) => !a.required);
                  const setAttr = (id: any, val: any) =>
                    setIdxAttrValues((prev) => {
                      const next = { ...prev };
                      if (val) next[id] = val; else delete next[id];
                      return next;
                    });
                  return (
                    <div className="space-y-3">
                      {vRows.length > 0 && (
                        <div className="space-y-2 p-3 rounded-lg bg-blue-50/60 border border-blue-200">
                          <p className="text-xs font-semibold text-blue-800">🎨 Varyantlar ({vRows.length}) — aynı ana ürün koduyla, her biri kendi renk/beden ve görselleriyle</p>
                          {vAttrs.length === 0 ? (
                            <p className="text-[11px] text-red-600">Bu Idefix kategorisinde varyant özelliği yok; varyantlar Idefix'te seçenek olarak görünmez.</p>
                          ) : idxSizeIntoColor(vAttrs, vRows) ? (
                            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">Bu kategoride beden özelliği yok; beden renk alanına yazıldı (ör. &quot;Siyah / Mavi - M&quot;).</p>
                          ) : null}
                          {vRows.map((v: any) => (
                            <div key={v.id} className="rounded border bg-white dark:bg-gray-900 p-2 space-y-1.5">
                              <div className="flex flex-wrap gap-2 text-xs">
                                <span className="font-semibold">{idxVariantLabel(v)}</span>
                                <span className="font-mono text-[10px] text-gray-500">{v.barcode}</span>
                                <span className="text-[10px] text-gray-500">{(v.images || []).length > 0 ? `${v.images.length} varyant görseli` : "ürünün görselleri"}</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {vAttrs.map((a: any) => (
                                  <div key={a.id} className="space-y-1">
                                    <Label className="text-[11px]">{a.name}</Label>
                                    <IdefixAttrInput
                                      attr={idxIsColor(a) && idxSizeIntoColor(vAttrs, vRows) ? { ...a, values: [] } : a}
                                      value={idxVariantValues[v.id]?.[a.id]}
                                      onChange={(val) =>
                                        setIdxVariantValues((prev) => {
                                          const row = { ...(prev[v.id] || {}) };
                                          if (val) row[a.id] = val; else delete row[a.id];
                                          return { ...prev, [v.id]: row };
                                        })
                                      }
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {reqs.length > 0 && (
                        <div className="space-y-2 p-3 rounded-lg bg-orange-50/60 border border-orange-200">
                          <p className="text-xs font-semibold text-orange-800">Zorunlu Özellikler ({reqs.length})</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {reqs.map((a: any) => (
                              <div key={a.id} className="space-y-1">
                                <Label className="text-[11px]">{a.name} <span className="text-red-500">*</span></Label>
                                <IdefixAttrInput attr={a} value={idxAttrValues[a.id]} onChange={(val) => setAttr(a.id, val)} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {opts.length > 0 && (
                        <details className="p-3 rounded-lg border bg-gray-50/60 dark:bg-gray-900/30">
                          <summary className="cursor-pointer text-xs font-semibold">İsteğe Bağlı Özellikler ({opts.length})</summary>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                            {opts.map((a: any) => (
                              <div key={a.id} className="space-y-1">
                                <Label className="text-[11px]">{a.name}</Label>
                                <IdefixAttrInput attr={a} value={idxAttrValues[a.id]} onChange={(val) => setAttr(a.id, val)} />
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="modalMfg" className="text-xs">Üretici / İmalatçı Bilgisi</Label>
                    <Input
                      id="modalMfg"
                      value={manufacturer}
                      onChange={(e) => setManufacturer(e.target.value)}
                      placeholder="Bardakcı Bike"
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="modalImp" className="text-xs">İthalatçı / Temsilci Bilgisi</Label>
                    <Input
                      id="modalImp"
                      value={importer}
                      onChange={(e) => setImporter(e.target.value)}
                      placeholder="Bardakcı Bike"
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              İptal
            </Button>
            <Button
              onClick={handleModalSubmit}
              disabled={sendingModal}
              className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
            >
              {sendingModal ? (
                <>
                  <RefreshCcw className="w-4 h-4 animate-spin" />
                  Gönderiliyor...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Idefix'e Gönder
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
