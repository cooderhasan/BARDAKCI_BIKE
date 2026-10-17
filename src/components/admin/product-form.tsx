"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { CategoryTreeSelect } from "@/components/ui/category-tree-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createProduct, updateProduct, syncProductToMarketplaces, searchProductsForBundle } from "@/app/admin/(protected)/products/actions";
import { generateSlug, generateSKU, generateBarcode } from "@/lib/helpers";
import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { Plus, X, ImageIcon, Trash2, Loader2, RefreshCcw, Package, RefreshCw, Brain, Search, AlertTriangle, Copy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import dynamic from "next/dynamic";
const RichTextEditor = dynamic(
    () => import("@/components/admin/rich-text-editor").then((mod) => mod.RichTextEditor),
    {
        ssr: false,
        loading: () => <div className="h-48 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center text-sm text-gray-400">Editör yükleniyor...</div>
    }
);
import { calculateDesi } from "@/lib/shipping";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { calculateBundleStock } from "@/lib/bundle-utils";


interface Brand {
    id: string;
    name: string;
    store?: string;
}

interface Category {
    id: string;
    name: string;
    parentId: string | null;
}

interface ProductVariant {
    id?: string;
    color: string;
    size: string;
    sku: string;
    barcode: string;
    stock: number;
    priceAdjustment: number;
    isActive: boolean;
    images?: string[];
}

interface BundleItemData {
    childProductId: string;
    quantity: number;
    childProduct: {
        id: string;
        name: string;
        sku: string | null;
        stock: number;
        listPrice: number;
        salePrice: number | null;
        image: string | null;
    };
}

interface Product {
    id: string;
    name: string;
    slug: string;
    sku: string | null;
    barcode: string | null;
    origin: string | null;
    brandId: string | null;
    description: string | null;
    marketplaceDescription?: string | null;
    listPrice: number;
    trendyolPrice?: number | null;
    n11Price?: number | null;
    hepsiburadaPrice?: number | null;
    idefixPrice?: number | null;
    salePrice?: number | null;
    vatRate: number | null;
    minQuantity: number;
    stock: number;
    criticalStock: number;
    categoryId: string | null;
    images: string[];
    isFeatured: boolean;
    isNew: boolean;
    isBestSeller: boolean;
    isActive: boolean;
    isFreeShipping?: boolean;
    isBundle?: boolean;
    isTrendyolActive?: boolean;
    isN11Active?: boolean;
    isHepsiburadaActive?: boolean;
    isIdefixActive?: boolean;
    isPazaramaActive?: boolean;
    pazaramaPrice?: number | null;
    isPttavmActive?: boolean;
    pttavmPrice?: number | null;
    isCiceksepetiActive?: boolean;
    ciceksepetiPrice?: number | null;
    isGoogleActive?: boolean;
    googlePrice?: number | null;
    weight?: number | null;
    width?: number | null;
    height?: number | null;
    length?: number | null;
    desi?: number | null;
    variants?: ProductVariant[];
    categories?: { id: string }[];
    referenceUrl?: string | null;
    n11CatalogId?: string | null;
    bundleItems?: BundleItemData[];
    gender?: string | null;
    brakeType?: string | null;
    trendyolCategoryId?: number | null;
    n11CategoryId?: number | null;
    hbCategoryId?: string | null;
    pttavmCategoryId?: number | null;
    idefixCategoryId?: string | null;
    ciceksepetiCategoryId?: string | null;
    pazaramaCategoryId?: string | null;
}

interface ProductFormProps {
    categories: Category[];
    brands: Brand[];
    product?: Product;
    defaultCriticalStock?: number;
}

export function ProductForm({ categories, brands, product, defaultCriticalStock = 10 }: ProductFormProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Initial State
    const [formData, setFormData] = useState({
        name: product?.name || "",
        slug: product?.slug || "",
        description: product?.description || "",
        marketplaceDescription: product?.marketplaceDescription || "",
        sku: product?.sku || "",
        barcode: product?.barcode || "",
        origin: product?.origin || "",
        brandId: product?.brandId || "none",
        categoryIds: product?.categories?.map(c => c.id) || (product?.categoryId ? [product.categoryId] : []) as string[],
        listPrice: product?.listPrice || "",
        trendyolPrice: product?.trendyolPrice || "",
        n11Price: product?.n11Price || "",
        hepsiburadaPrice: product?.hepsiburadaPrice || "",
        idefixPrice: product?.idefixPrice || "",
        salePrice: product?.salePrice || "",
        vatRate: product?.vatRate?.toString() || "20",
        minQuantity: product?.minQuantity || 1,
        stock: product?.stock || 0,
        criticalStock: product?.criticalStock ?? defaultCriticalStock,
        images: product?.images || [] as string[],
        variants: product?.variants || [] as ProductVariant[],
        isActive: product?.isActive ?? true,
        isFreeShipping: product?.isFreeShipping ?? false,
        store: ((product as any)?.store as "BIKE" | "MOTOR" | "BOTH") || "BIKE",
        isTrendyolActive: product?.isTrendyolActive ?? false,
        isN11Active: product?.isN11Active ?? false,
        isHepsiburadaActive: product?.isHepsiburadaActive ?? false,
        isIdefixActive: (product as any)?.isIdefixActive ?? false,
        isPazaramaActive: (product as any)?.isPazaramaActive ?? false,
        pazaramaPrice: (product as any)?.pazaramaPrice || "",
        isPttavmActive: (product as any)?.isPttavmActive ?? false,
        pttavmPrice: (product as any)?.pttavmPrice || "",
        isCiceksepetiActive: (product as any)?.isCiceksepetiActive ?? false,
        ciceksepetiPrice: (product as any)?.ciceksepetiPrice || "",
        isGoogleActive: product?.isGoogleActive ?? false,
        googlePrice: product?.googlePrice || "",
        isFeatured: product?.isFeatured || false,
        isNew: product?.isNew || false,
        isBestSeller: product?.isBestSeller || false,
        weight: product?.weight ?? "",
        width: product?.width ?? "",
        height: product?.height ?? "",
        length: product?.length ?? "",
        desi: product?.desi ?? "",
        referenceUrl: product?.referenceUrl || "",
        n11CatalogId: product?.n11CatalogId || "",
        isBundle: product?.isBundle || false,
        gender: product?.gender || "none",
        brakeType: product?.brakeType || "none",
        trendyolCategoryId: product?.trendyolCategoryId ? String(product.trendyolCategoryId) : "",
        n11CategoryId: product?.n11CategoryId ? String(product.n11CategoryId) : "",
        hbCategoryId: product?.hbCategoryId || "",
        pttavmCategoryId: product?.pttavmCategoryId ? String(product.pttavmCategoryId) : "",
        idefixCategoryId: product?.idefixCategoryId || "",
        ciceksepetiCategoryId: product?.ciceksepetiCategoryId || "",
        pazaramaCategoryId: product?.pazaramaCategoryId || "",
    });

    // Bundle state
    const [bundleItems, setBundleItems] = useState<BundleItemData[]>(product?.bundleItems || []);
    const [bundleSearchQuery, setBundleSearchQuery] = useState("");
    const [bundleSearchResults, setBundleSearchResults] = useState<any[]>([]);
    const [bundleSearching, setBundleSearching] = useState(false);

    // Otomatik desi hesaplama
    const autoDesi = formData.width && formData.height && formData.length
        ? calculateDesi(Number(formData.width), Number(formData.height), Number(formData.length))
        : 0;

    const handleChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));

        // Auto-generate slug if name changes and it's a new product (no ID)
        if (field === "name" && !product) {
            setFormData(prev => ({ ...prev, slug: generateSlug(value), name: value }));
        }
    };

    const hasVariants = formData.variants.length > 0;

    // --- Varyant yönetimi: toplu oluşturma, renge göre gruplama ---
    const [bulkColors, setBulkColors] = useState("");
    const [bulkSizes, setBulkSizes] = useState("");
    const VARIANT_SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "XXXL", "3XL", "4XL"];
    const variantSizeRank = (size?: string | null) => {
        const i = VARIANT_SIZE_ORDER.indexOf(String(size || "").trim().toUpperCase());
        return i === -1 ? 100 : i;
    };
    const variantKey = (v: { color?: string | null; size?: string | null }) =>
        `${String(v.color || "").trim().toLocaleLowerCase("tr-TR")}|${String(v.size || "").trim().toLocaleLowerCase("tr-TR")}`;
    const splitList = (text: string) => [...new Set(text.split(",").map((x) => x.trim()).filter(Boolean))];
    const colorImagesOf = (color: string) =>
        formData.variants.find((v) => (v.color || "").trim() === color && (v.images || []).length > 0)?.images || [];

    /** Renk × beden kombinasyonlarını stok kodu ve barkoduyla ekler; var olanları atlar */
    const generateVariantCombos = () => {
        const cs = splitList(bulkColors);
        const ss = splitList(bulkSizes);
        if (cs.length === 0 && ss.length === 0) {
            toast.warning("Renk veya beden girin (virgülle ayırarak).");
            return;
        }
        const existing = new Set(formData.variants.map(variantKey));
        const added: ProductVariant[] = [];
        for (const c of cs.length > 0 ? cs : [""]) {
            for (const sz of ss.length > 0 ? ss : [""]) {
                if (existing.has(variantKey({ color: c, size: sz }))) continue;
                existing.add(variantKey({ color: c, size: sz }));
                added.push({
                    color: c,
                    size: sz,
                    sku: generateSKU(),
                    barcode: generateBarcode(),
                    stock: 0,
                    priceAdjustment: 0,
                    isActive: true,
                    images: [...colorImagesOf(c)],
                });
            }
        }
        if (added.length === 0) {
            toast.info("Bu kombinasyonların hepsi zaten var.");
            return;
        }
        handleChange("variants", [...formData.variants, ...added]);
        toast.success(`${added.length} varyant eklendi. Stokları girmeyi unutmayın.`);
        setBulkColors("");
        setBulkSizes("");
    };

    // Renge göre gruplar (sıra: ilk görüldüğü sıra; grup içinde beden sırası)
    const variantGroups = (() => {
        const m = new Map<string, number[]>();
        formData.variants.forEach((v, i) => {
            const k = (v.color || "").trim();
            if (!m.has(k)) m.set(k, []);
            m.get(k)!.push(i);
        });
        return [...m.entries()].map(([color, idxs]) => ({
            color,
            firstIndex: Math.min(...idxs),
            idxs: [...idxs].sort((a, b) => variantSizeRank(formData.variants[a].size) - variantSizeRank(formData.variants[b].size)),
        }));
    })();
    const updateVariantGroup = (idxs: number[], patch: Partial<ProductVariant>) =>
        handleChange("variants", formData.variants.map((v, i) => (idxs.includes(i) ? { ...v, ...patch } : v)));
    const addVariantToGroup = (color: string) =>
        handleChange("variants", [
            ...formData.variants,
            { color, size: "", sku: generateSKU(), barcode: generateBarcode(), stock: 0, priceAdjustment: 0, isActive: true, images: [...colorImagesOf(color)] },
        ]);
    const removeVariantGroup = (idxs: number[], color: string) => {
        if (!window.confirm(`"${color || "Renksiz"}" rengindeki ${idxs.length} varyant silinsin mi?`)) return;
        handleChange("variants", formData.variants.filter((_, i) => !idxs.includes(i)));
    };
    // Aynı renk + beden iki kez girilmişse (kayıtta hata verir)
    const duplicateVariantKeys = (() => {
        const seen = new Set<string>();
        const dup = new Set<string>();
        for (const v of formData.variants) {
            const k = variantKey(v);
            if (seen.has(k)) dup.add(k);
            seen.add(k);
        }
        return dup;
    })();
    const knownColors = [...new Set(formData.variants.map((v) => (v.color || "").trim()).filter(Boolean))];
    const knownSizes = [...new Set([...formData.variants.map((v) => (v.size || "").trim()).filter(Boolean), ...VARIANT_SIZE_ORDER.slice(1, 8)])];
    const variantStockTotal = formData.variants.reduce((sum, v) => sum + (v.isActive === false ? 0 : Number(v.stock) || 0), 0);

    const addVariant = () => {
        handleChange("variants", [
            ...formData.variants,
            {
                color: "",
                size: "",
                sku: "",
                barcode: "",
                stock: 0,
                priceAdjustment: 0,
                isActive: true,
                images: [],
            },
        ]);
    };

    const removeVariant = (index: number) => {
        handleChange("variants", formData.variants.filter((_, i) => i !== index));
    };

    const updateVariant = (index: number, field: keyof ProductVariant, value: string | number | boolean | string[]) => {
        const updated = [...formData.variants];
        updated[index] = { ...updated[index], [field]: value };
        handleChange("variants", updated);
    };

    // Bundle functions
    const bundleStock = formData.isBundle ? calculateBundleStock(bundleItems) : 0;

    const handleBundleSearch = useCallback(async (query: string) => {
        setBundleSearchQuery(query);
        if (query.length < 2) {
            setBundleSearchResults([]);
            return;
        }
        setBundleSearching(true);
        try {
            const results = await searchProductsForBundle(query, product?.id);
            setBundleSearchResults(results);
        } catch {
            toast.error("Ürün arama başarısız.");
        } finally {
            setBundleSearching(false);
        }
    }, [product?.id]);

    const addBundleItem = (item: any) => {
        if (bundleItems.find(bi => bi.childProductId === item.id)) {
            toast.warning("Bu ürün zaten pakette mevcut.");
            return;
        }
        setBundleItems(prev => [...prev, {
            childProductId: item.id,
            quantity: 1,
            childProduct: {
                id: item.id,
                name: item.name,
                sku: item.sku,
                stock: item.stock,
                listPrice: item.listPrice,
                salePrice: item.salePrice,
                image: item.image,
            },
        }]);
        setBundleSearchQuery("");
        setBundleSearchResults([]);
    };

    const removeBundleItem = (childProductId: string) => {
        setBundleItems(prev => prev.filter(bi => bi.childProductId !== childProductId));
    };

    const updateBundleItemQuantity = (childProductId: string, quantity: number) => {
        if (quantity < 1) return;
        setBundleItems(prev => prev.map(bi =>
            bi.childProductId === childProductId
                ? { ...bi, quantity }
                : bi
        ));
    };

    const handleMarketplaceSync = async () => {
        if (!product?.id) {
            toast.error("Önce ürünü kaydetmelisiniz.");
            return;
        }

        if (!window.confirm("Bu ürünün fiyat ve stok bilgileri aktif pazar yerlerine gönderilecek. Onaylıyor musunuz?")) return;

        setLoading(true);
        try {
            const result = await syncProductToMarketplaces(product.id);
            if (result.success) {
                toast.success(result.message);
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            toast.error("Bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploading(true);
        const newImages: string[] = [];

        for (const file of Array.from(files)) {
            const uploadData = new FormData();
            uploadData.append("file", file);

            try {
                const response = await fetch("/api/upload", {
                    method: "POST",
                    body: uploadData,
                });

                if (response.ok) {
                    const data = await response.json();
                    newImages.push(data.url);
                } else {
                    toast.error("Görsel yüklenemedi");
                }
            } catch {
                toast.error("Yükleme hatası oluştu");
            }
        }

        if (newImages.length > 0) {
            handleChange("images", [...formData.images, ...newImages]);
        }
        setUploading(false);
        e.target.value = "";
    };

    const removeImage = (index: number) => {
        handleChange("images", formData.images.filter((_, i) => i !== index));
    };

    // Görsel sırası: ilk görsel ana görseldir (sitede, listelerde ve pazaryerlerinde ilk gösterilen)
    const moveImage = (from: number, to: number) => {
        if (to < 0 || to >= formData.images.length || from === to) return;
        const next = [...formData.images];
        const [img] = next.splice(from, 1);
        next.splice(to, 0, img);
        handleChange("images", next);
    };

    const marketplacePriceFields = [
        { key: "trendyolPrice", activeKey: "isTrendyolActive", label: "Trendyol" },
        { key: "n11Price", activeKey: "isN11Active", label: "N11" },
        { key: "hepsiburadaPrice", activeKey: "isHepsiburadaActive", label: "Hepsiburada" },
        { key: "idefixPrice", activeKey: "isIdefixActive", label: "İdefix" },
        { key: "pazaramaPrice", activeKey: "isPazaramaActive", label: "Pazarama" },
        { key: "pttavmPrice", activeKey: "isPttavmActive", label: "ePttAVM" },
        { key: "ciceksepetiPrice", activeKey: "isCiceksepetiActive", label: "Çiçeksepeti" },
    ];

    const applyPriceToAllMarketplaces = () => {
        // Find the first filled marketplace price — NEVER use listPrice
        const firstFilledField = marketplacePriceFields.find(f => {
            const val = (formData as any)[f.key];
            return val !== "" && val !== null && val !== undefined && Number(val) > 0;
        });
        if (!firstFilledField) {
            toast.error("Önce en az bir pazaryerine fiyat girin! (Liste fiyatı kullanılmaz, komisyonlu fiyat girmeniz gerekiyor)");
            return;
        }
        const priceToApply = (formData as any)[firstFilledField.key];
        const updates: any = {};
        marketplacePriceFields.forEach(f => {
            if (f.key === firstFilledField.key) return; // skip the source
            const val = (formData as any)[f.key];
            if (!val || val === "" || Number(val) === 0) {
                updates[f.key] = priceToApply;
            }
        });
        if (Object.keys(updates).length === 0) {
            toast.info("Tüm pazaryeri fiyatları zaten dolu.");
            return;
        }
        setFormData(prev => ({ ...prev, ...updates }));
        toast.success(`${firstFilledField.label} fiyatı (${Number(priceToApply).toLocaleString("tr-TR")}₺) → ${Object.keys(updates).length} pazaryerine uygulandı.`);
    };

    const marketplaceColors: Record<string, string> = {
        trendyolPrice: "text-orange-600",
        n11Price: "text-purple-600",
        hepsiburadaPrice: "text-orange-600",
        idefixPrice: "text-purple-600",
        pazaramaPrice: "text-pink-600",
        pttavmPrice: "text-teal-600",
        ciceksepetiPrice: "text-rose-600",
    };

    // Pazaryeri gönderim seçimlerinin hepsini aç/kapat (Google dahil)
    const setAllMarketplacesActive = (value: boolean) => {
        const updates: any = { isGoogleActive: value };
        marketplacePriceFields.forEach(f => { updates[f.activeKey] = value; });
        setFormData(prev => ({ ...prev, ...updates }));
    };

    // Yeni ürün eklerken son eklenen ürünün mağaza / KDV / pazaryeri seçimleri hatırlanır (sadece bu tarayıcıda)
    const REMEMBER_KEY = "admin_new_product_defaults";
    const rememberKeys = ["store", "vatRate", "isGoogleActive", ...marketplacePriceFields.map(f => f.activeKey)];
    const [rememberedApplied, setRememberedApplied] = useState(false);
    useEffect(() => {
        if (product) return;
        try {
            const raw = localStorage.getItem(REMEMBER_KEY);
            if (!raw) return;
            const saved = JSON.parse(raw);
            const updates: any = {};
            for (const k of rememberKeys) if (saved && k in saved) updates[k] = saved[k];
            if (Object.keys(updates).length > 0) {
                setFormData(prev => ({ ...prev, ...updates }));
                setRememberedApplied(true);
            }
        } catch { /* tarayıcı depolaması yoksa varsayılanlarla devam */ }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // "Kaydet ve Yeni Ekle" butonu ile gönderildiyse kayıttan sonra boş yeni ürün formu açılır
    const saveAndNewRef = useRef(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const saveAndNew = saveAndNewRef.current;
        saveAndNewRef.current = false;

        // Aynı renk + beden iki kez girilmişse kayıt veritabanında hata verir
        if (duplicateVariantKeys.size > 0) {
            toast.error("Aynı renk ve bedende birden fazla varyant var. Varyantlar sekmesinde kırmızı işaretli satırları düzeltin.");
            return;
        }

        // Pazaryeri fiyat validasyonu: Diğer pazaryerlerinde fiyat varken boş olan varsa uyar
        const filledMarketplaces = marketplacePriceFields.filter(f => {
            const price = (formData as any)[f.key];
            return price && price !== "" && Number(price) > 0;
        });
        const emptyMarketplaces = marketplacePriceFields.filter(f => {
            const price = (formData as any)[f.key];
            return !price || price === "" || Number(price) === 0;
        });

        // En az bir pazaryerinde fiyat varken diğerleri boşsa uyar
        if (filledMarketplaces.length > 0 && emptyMarketplaces.length > 0) {
            const emptyNames = emptyMarketplaces.map(f => f.label).join(", ");
            const confirmed = window.confirm(
                `⚠️ DİKKAT!\n\nŞu pazaryerlerinin fiyatı boş: ${emptyNames}\n\nBoş bırakılan pazaryerlerine LİSTE FİYATI (${Number(formData.listPrice).toLocaleString("tr-TR")}₺) gönderilecek!\n\nBu genellikle komisyonsuz düşük fiyat demektir.\n\nDevam etmek istiyor musunuz?`
            );
            if (!confirmed) {
                return;
            }
        }

        setLoading(true);

        const data = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
            if (key === 'variants' || key === 'images' || key === 'categoryIds') {
                data.append(key, JSON.stringify(value));
            } else {
                data.append(key, String(value));
            }
        });

        // Varyantlı üründe ana stok = aktif varyant toplamı (sunucu da yeniden hesaplar)
        if (!formData.isBundle && hasVariants) {
            data.set('stock', String(variantStockTotal));
        }

        // Append bundle items if this is a bundle product
        if (formData.isBundle) {
            data.set('stock', String(bundleStock));
            data.append('bundleItems', JSON.stringify(bundleItems.map(bi => ({
                childProductId: bi.childProductId,
                quantity: bi.quantity,
            }))));
        }

        try {
            let result;
            if (product) {
                result = await updateProduct(product.id, data);
            } else {
                result = await createProduct(data);
            }

            if (result?.success) {
                toast.success(product ? "Ürün güncellendi" : "Ürün oluşturuldu");
                if (!product) {
                    try {
                        const toSave: any = {};
                        for (const k of rememberKeys) toSave[k] = (formData as any)[k];
                        localStorage.setItem(REMEMBER_KEY, JSON.stringify(toSave));
                    } catch { /* yoksay */ }
                    setTimeout(() => {
                        if (saveAndNew) {
                            // Aynı sayfa olduğu için formu tamamen sıfırlamak adına yeniden yüklenir
                            window.location.assign("/admin/products/new");
                            return;
                        }
                        router.push("/admin/products");
                        router.refresh();
                    }, 1000);
                } else {
                    router.refresh();
                }
            } else {
                toast.error((result as any)?.error || "Bir hata oluştu");
            }
        } catch (error: any) {
            console.error("Save error:", error);
            toast.error(error?.message || "Kaydetme başarısız");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="relative pb-24">
            <Tabs defaultValue="general" className="space-y-6">
                <TabsList className="bg-white dark:bg-gray-800 p-1 rounded-lg border flex flex-wrap h-auto sticky top-4 z-10 shadow-sm gap-2">
                    <TabsTrigger value="general" className="px-4 py-2">Genel Bilgiler</TabsTrigger>
                    <TabsTrigger value="price" className="px-4 py-2">Fiyat & Stok</TabsTrigger>
                    <TabsTrigger value="variants" className="px-4 py-2">Varyantlar</TabsTrigger>
                    <TabsTrigger value="bundle" className="px-4 py-2">
                        <Package className="h-4 w-4 mr-1" />
                        Paket İçeriği
                        {formData.isBundle && bundleItems.length > 0 && (
                            <span className="ml-1.5 bg-emerald-100 text-emerald-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{bundleItems.length}</span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="media" className="px-4 py-2">Görseller</TabsTrigger>
                    <TabsTrigger value="settings" className="px-4 py-2">Ayarlar</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Temel Bilgiler</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Ürün Adı *</Label>
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={(e) => handleChange("name", e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="slug">URL (Slug) *</Label>
                                    <Input
                                        id="slug"
                                        value={formData.slug}
                                        onChange={(e) => handleChange("slug", e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="categoryIds">Kategoriler</Label>
                                    <CategoryTreeSelect
                                        options={categories}
                                        selected={formData.categoryIds}
                                        onChange={(vals: string[]) => handleChange("categoryIds", vals)}
                                        placeholder="Kategori seçin"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="brandId">Marka</Label>
                                    <Select
                                        value={formData.brandId}
                                        onValueChange={(val) => handleChange("brandId", val)}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Marka seçin" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Markasız</SelectItem>
                                            {brands
                                                .filter((b) => {
                                                    if (!b.store || b.store === "BOTH") return true;
                                                    if (formData.store === "BOTH") return true;
                                                    return b.store === formData.store;
                                                })
                                                .map((b) => (
                                                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="gender">Cinsiyet</Label>
                                    <Select
                                        value={formData.gender || "none"}
                                        onValueChange={(val) => handleChange("gender", val)}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Cinsiyet seçin" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Belirtilmemiş</SelectItem>
                                            <SelectItem value="Erkek">Erkek</SelectItem>
                                            <SelectItem value="Kadın">Kadın</SelectItem>
                                            <SelectItem value="Unisex">Unisex</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="brakeType">Fren Tipi</Label>
                                    <Select
                                        value={formData.brakeType || "none"}
                                        onValueChange={(val) => handleChange("brakeType", val)}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Fren tipi seçin" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Belirtilmemiş</SelectItem>
                                            <SelectItem value="V FREN">V FREN</SelectItem>
                                            <SelectItem value="Mekanik Disk Fren">Mekanik Disk Fren</SelectItem>
                                            <SelectItem value="Hidrolik Disk Fren">Hidrolik Disk Fren</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-4 p-4 bg-[#17457C]/5 dark:bg-[#17457C]/10 border border-[#17457C]/20 dark:border-[#17457C]/30 rounded-xl">
                                <div className="flex items-center gap-2 text-[#17457C] dark:text-blue-300 font-semibold mb-1">
                                    <Brain className="w-5 h-5 text-[#17457C]" />
                                    <span>AI İçerik Asistanı (Opsiyonel)</span>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="referenceUrl" className="text-xs font-medium">Referans Ürün Bilgisi / Üretici Metni</Label>
                                    <div className="flex flex-col gap-3">
                                        <Textarea
                                            id="referenceUrl"
                                            value={formData.referenceUrl}
                                            onChange={(e) => handleChange("referenceUrl", e.target.value)}
                                            placeholder="Üretici sitesinden kopyaladığınız karışık veya ham ürün bilgilerini (veya referans ürün linkini) buraya yapıştırın. Yapay zeka bu metni düzenleyip SEO uyumlu hale getirecek, önemli kısımları kalın yazacak ve en alta teknik özellikler tablosu ekleyecektir."
                                            className="bg-white dark:bg-gray-800 min-h-[120px] resize-y"
                                        />
                                        <Button
                                            type="button"
                                            onClick={async () => {
                                                if (!formData.referenceUrl) {
                                                    toast.error("Lütfen düzeltilecek ham metni veya bir referans linki girin.");
                                                    return;
                                                }
                                                setLoading(true);
                                                try {
                                                    const isUrl = formData.referenceUrl.trim().startsWith("http://") || formData.referenceUrl.trim().startsWith("https://");
                                                    const payload = isUrl 
                                                        ? { url: formData.referenceUrl.trim() } 
                                                        : { text: formData.referenceUrl, productName: formData.name };

                                                    const res = await fetch("/api/admin/ai/generate-description", {
                                                        method: "POST",
                                                        body: JSON.stringify(payload),
                                                    });
                                                    const result = await res.json();
                                                    if (result.success && result.data) {
                                                        handleChange("description", result.data);
                                                        if (!formData.name && result.sourceName) {
                                                            handleChange("name", result.sourceName);
                                                        }
                                                        toast.success("Özgün içerik başarıyla oluşturuldu.");
                                                    } else if (result.success && !result.data) {
                                                        toast.error("Yapay zeka içerik üretemedi. Lütfen tekrar deneyin.");
                                                    } else {
                                                        toast.error(result.error || "İşlem başarısız.");
                                                    }
                                                } catch {
                                                    toast.error("Bir hata oluştu.");
                                                } finally {
                                                    setLoading(false);
                                                }
                                            }}
                                            disabled={loading}
                                            className="bg-[#17457C] hover:bg-[#0f3460] text-white w-full md:w-auto self-end font-semibold transition-colors flex items-center justify-center gap-2"
                                        >
                                            {loading ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span>İçerik Oluşturuluyor...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Brain className="w-4 h-4" />
                                                    <span>AI ile Açıklama ve Teknik Tablo Oluştur</span>
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                    <p className="text-[10px] text-gray-500 italic">
                                        * Yapıştırılan ham metin veya linkten çekilen bilgiler AI tarafından SEO'ya uygun şekilde düzenlenir, önemli kısımlar vurgulanır ve teknik özellik tablosu oluşturulur.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Ürün Açıklaması</Label>
                                <RichTextEditor
                                    content={formData.description}
                                    onChange={(html) => handleChange("description", html)}
                                    placeholder="Ürün açıklaması..."
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex flex-col gap-1">
                                    <Label>Pazar Yeri Açıklaması (Opsiyonel)</Label>
                                    <span className="text-xs text-gray-500">
                                        Pazar yerleri için özel açıklama. Boş bırakılırsa normal ürün açıklaması gönderilir. Pazar yerleri çok uzun açıklamaları kabul etmediği için buraya daha kısa ve öz açıklamalar girebilirsiniz.
                                    </span>
                                </div>
                                <RichTextEditor
                                    content={formData.marketplaceDescription}
                                    onChange={(html) => handleChange("marketplaceDescription", html)}
                                    placeholder="Pazar yerleri için ürün açıklaması..."
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="price" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Fiyatlandırma & Stok</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Liste Fiyatı, İndirimli Fiyat, KDV - tek satır */}
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <div className="space-y-2">
                                    <Label htmlFor="listPrice">Liste Fiyatı (₺) *</Label>
                                    <Input
                                        id="listPrice"
                                        type="number"
                                        step="0.01"
                                        value={formData.listPrice}
                                        onChange={(e) => handleChange("listPrice", e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="salePrice" className="text-red-600 font-bold">İndirimli Fiyat (₺)</Label>
                                    <Input
                                        id="salePrice"
                                        type="number"
                                        step="0.01"
                                        value={formData.salePrice}
                                        onChange={(e) => handleChange("salePrice", e.target.value)}
                                        placeholder="İndirimli satış fiyatı"
                                        className="border-red-200 focus:border-red-500 bg-red-50/50"
                                    />
                                    <p className="text-[10px] text-gray-500">Girilirse bu fiyat geçerli olur, liste fiyatı üstü çizili görünür.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="vatRate">KDV Oranı *</Label>
                                    <Select
                                        value={formData.vatRate}
                                        onValueChange={(val) => handleChange("vatRate", val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="10">%10</SelectItem>
                                            <SelectItem value="20">%20</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Pazaryerleri: gönderim seçimi + fiyat tek yerde (önceden seçim Ayarlar sekmesindeydi) */}
                            <div className="border rounded-lg p-4 bg-gray-50/50 dark:bg-gray-900/30 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex flex-wrap items-center gap-2">
                                        🏪 Pazaryerleri
                                        {rememberedApplied && (
                                            <span className="text-[10px] font-normal text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">son eklenen ürünün seçimleri getirildi</span>
                                        )}
                                    </h4>
                                    <div className="flex flex-wrap gap-1.5">
                                        <Button type="button" variant="outline" size="sm" className="text-xs h-7" onClick={() => setAllMarketplacesActive(true)}>
                                            Hepsini Seç
                                        </Button>
                                        <Button type="button" variant="outline" size="sm" className="text-xs h-7" onClick={() => setAllMarketplacesActive(false)}>
                                            Hepsini Kaldır
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={applyPriceToAllMarketplaces}
                                            className="text-xs h-7 gap-1"
                                        >
                                            <Copy className="h-3 w-3" />
                                            Boş Olanlara İlk Fiyatı Uygula
                                        </Button>
                                    </div>
                                </div>
                                <p className="text-[10px] text-gray-500 -mt-1">
                                    İşaretli pazaryerlerine gönderilir. Boş bırakılan fiyat yerine liste fiyatı gönderilir; komisyon eklenmiş fiyatları girmeyi unutmayın!
                                </p>

                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                    {marketplacePriceFields.map((field) => {
                                        const price = (formData as any)[field.key];
                                        const isEmpty = !price || price === "" || Number(price) === 0;
                                        const isActive = Boolean((formData as any)[field.activeKey]);
                                        const hasAnyOtherFilled = marketplacePriceFields.some(f => {
                                            if (f.key === field.key) return false;
                                            const v = (formData as any)[f.key];
                                            return v && v !== "" && Number(v) > 0;
                                        });
                                        const showWarning = isEmpty && hasAnyOtherFilled;
                                        const color = marketplaceColors[field.key] || "text-gray-700";

                                        return (
                                            <div key={field.key} className={`rounded-md border px-2.5 py-2 space-y-1.5 ${showWarning ? "bg-amber-50 border-amber-300" : isActive ? "bg-white dark:bg-gray-800 border-gray-300" : "bg-white/60 dark:bg-gray-800/50 border-gray-200"}`}>
                                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                                    <Checkbox
                                                        checked={isActive}
                                                        onCheckedChange={(c) => handleChange(field.activeKey, c === true)}
                                                    />
                                                    <span className={`text-sm font-semibold ${color}`}>{field.label}</span>
                                                    {showWarning && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 ml-auto" />}
                                                </label>
                                                <Input
                                                    id={field.key}
                                                    type="number"
                                                    step="0.01"
                                                    value={price}
                                                    onChange={(e) => handleChange(field.key, e.target.value)}
                                                    placeholder={`Boş = ${Number(formData.listPrice || 0).toLocaleString("tr-TR")}₺`}
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                        );
                                    })}
                                    {/* Google Shopping: fiyat boşsa liste fiyatı kullanılır (eski davranış) */}
                                    <div className={`rounded-md border px-2.5 py-2 space-y-1.5 ${formData.isGoogleActive ? "bg-white dark:bg-gray-800 border-gray-300" : "bg-white/60 dark:bg-gray-800/50 border-gray-200"}`}>
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <Checkbox
                                                checked={Boolean(formData.isGoogleActive)}
                                                onCheckedChange={(c) => handleChange("isGoogleActive", c === true)}
                                            />
                                            <span className="text-sm font-semibold text-blue-700">🛒 Google Shopping</span>
                                        </label>
                                        <Input
                                            id="googlePrice"
                                            type="number"
                                            step="0.01"
                                            value={formData.googlePrice}
                                            onChange={(e) => handleChange("googlePrice", e.target.value)}
                                            placeholder="Boş = Liste fiyatı"
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            <hr />

                            {/* Kodlar ve stok: iki satır, üçer alan */}
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <div className="space-y-2 relative">
                                    <Label htmlFor="sku">Stok Kodu (SKU)</Label>
                                    <Input
                                        id="sku"
                                        value={formData.sku}
                                        onChange={(e) => handleChange("sku", e.target.value)}
                                        placeholder="PRD-001"
                                        className="pr-11"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="absolute right-0 top-6"
                                        onClick={() => handleChange("sku", generateSKU())}
                                        title="Rastgele SKU Oluştur"
                                    >
                                        <RefreshCcw className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="space-y-2 relative">
                                    <Label htmlFor="barcode">Barkod</Label>
                                    <Input
                                        id="barcode"
                                        value={formData.barcode}
                                        onChange={(e) => handleChange("barcode", e.target.value)}
                                        placeholder="869..."
                                        className="pr-11"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="absolute right-0 top-6"
                                        onClick={() => handleChange("barcode", generateBarcode())}
                                        title="Rastgele Barkod Oluştur"
                                    >
                                        <RefreshCcw className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="origin">Menşei</Label>
                                    <Input
                                        id="origin"
                                        value={formData.origin}
                                        onChange={(e) => handleChange("origin", e.target.value)}
                                        placeholder="Türkiye"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="stock">Stok Adedi</Label>
                                    <Input
                                        id="stock"
                                        type="number"
                                        value={formData.isBundle ? bundleStock : hasVariants ? variantStockTotal : formData.stock}
                                        onChange={(e) => handleChange("stock", e.target.value)}
                                        disabled={formData.isBundle || hasVariants}
                                    />
                                    {!formData.isBundle && hasVariants && (
                                        <p className="text-xs text-blue-600 font-medium">
                                            🎨 Varyantlı ürün: stok varyantlarda tutulur, burada aktif varyantların toplamı ({variantStockTotal} adet) görünür.
                                        </p>
                                    )}
                                    {formData.isBundle && (
                                        <p className="text-xs text-emerald-600 font-medium">
                                            📦 Paket stoğu içeriğe göre otomatik ({bundleStock} adet) hesaplanmaktadır.
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="criticalStock">Kritik Stok Seviyesi</Label>
                                    <Input
                                        id="criticalStock"
                                        type="number"
                                        value={formData.criticalStock}
                                        onChange={(e) => handleChange("criticalStock", e.target.value)}
                                        placeholder="10"
                                    />
                                    <p className="text-xs text-gray-500">Stok bu seviyeye düşünce uyarı verilir</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="minQuantity">Min. Sipariş Adedi</Label>
                                    <Input
                                        id="minQuantity"
                                        type="number"
                                        value={formData.minQuantity}
                                        onChange={(e) => handleChange("minQuantity", e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Package className="h-5 w-5 text-blue-500" />
                                Kargo Bilgileri (Desi)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Ücretsiz Kargo Toggle */}
                            <div className={`flex items-center justify-between p-4 rounded-lg border-2 transition-colors ${
                                formData.isFreeShipping 
                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700' 
                                    : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
                            }`}>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">🚚</span>
                                        <Label htmlFor="isFreeShipping" className="text-base font-semibold cursor-pointer">
                                            Bu Üründe Ücretsiz Kargo
                                        </Label>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-8">
                                        Aktifse bu ürün için kargo ücreti hesaplanmaz. Bisikletlerde açık, yedek parça/aksesuarda kapalı tutun.
                                    </p>
                                </div>
                                <Checkbox
                                    id="isFreeShipping"
                                    checked={formData.isFreeShipping}
                                    onCheckedChange={(checked) => handleChange("isFreeShipping", !!checked)}
                                    className="h-6 w-6"
                                />
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                                <p className="text-sm text-blue-800 dark:text-blue-200">
                                    <strong>Bilgi:</strong> Desi = (En × Boy × Yükseklik) / 3000. Kargo firmaları ağırlık ve desi değerlerinden büyük olanı baz alır.
                                </p>
                            </div>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="weight">Ağırlık (kg)</Label>
                                    <Input
                                        id="weight"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.weight}
                                        onChange={(e) => handleChange("weight", e.target.value)}
                                        placeholder="Ör: 2.50"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="desi">Desi (Manuel)</Label>
                                    <Input
                                        id="desi"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.desi}
                                        onChange={(e) => handleChange("desi", e.target.value)}
                                        placeholder={autoDesi > 0 ? `Otomatik: ${autoDesi}` : "Ör: 3.00"}
                                    />
                                    <p className="text-xs text-gray-500">Boş bırakılırsa boyutlardan otomatik hesaplanır.</p>
                                </div>
                            </div>

                            <hr />

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <div className="space-y-2">
                                    <Label htmlFor="width">Genişlik (cm)</Label>
                                    <Input
                                        id="width"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.width}
                                        onChange={(e) => handleChange("width", e.target.value)}
                                        placeholder="Ör: 30"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="height">Yükseklik (cm)</Label>
                                    <Input
                                        id="height"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.height}
                                        onChange={(e) => handleChange("height", e.target.value)}
                                        placeholder="Ör: 20"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="length">Uzunluk (cm)</Label>
                                    <Input
                                        id="length"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.length}
                                        onChange={(e) => handleChange("length", e.target.value)}
                                        placeholder="Ör: 15"
                                    />
                                </div>
                            </div>

                            {(autoDesi > 0 || Number(formData.weight) > 0) && (
                                <div className="bg-gray-50 dark:bg-gray-800 border rounded-lg p-4 mt-2">
                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                        <div>
                                            <span className="text-gray-500">Hacimsel Desi:</span>
                                            <p className="font-semibold">{autoDesi > 0 ? autoDesi : "-"}</p>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Ağırlık:</span>
                                            <p className="font-semibold">{Number(formData.weight) > 0 ? `${formData.weight} kg` : "-"}</p>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Efektif Desi:</span>
                                            <p className="font-bold text-[#17457C]">
                                                {Math.max(autoDesi, Number(formData.weight) || 0, Number(formData.desi) || 0).toFixed(2)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="variants" className="space-y-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Varyantlar {formData.variants.length > 0 && <span className="text-sm font-normal text-gray-500">({formData.variants.length})</span>}</CardTitle>
                            <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                                <Plus className="h-4 w-4 mr-1" /> Tek Varyant Ekle
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Toplu oluşturma: renkler × bedenler */}
                            <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 space-y-2 dark:border-blue-900 dark:bg-blue-950/20">
                                <div className="text-sm font-semibold text-blue-900 dark:text-blue-200">Toplu Varyant Oluştur</div>
                                <p className="text-xs text-blue-700 dark:text-blue-300">
                                    Renkleri ve bedenleri virgülle ayırarak yazın; tüm kombinasyonlar stok kodu ve barkoduyla eklenir. Var olanlar tekrar eklenmez, istemediğinizi silebilirsiniz.
                                </p>
                                <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
                                    <Input value={bulkColors} onChange={(e) => setBulkColors(e.target.value)} placeholder="Renkler: Siyah / Mavi, Siyah / Kırmızı" />
                                    <Input value={bulkSizes} onChange={(e) => setBulkSizes(e.target.value)} placeholder="Bedenler: S, M, L, XL, XXL" />
                                    <Button type="button" onClick={generateVariantCombos}>
                                        <Plus className="h-4 w-4 mr-1" /> Oluştur
                                    </Button>
                                </div>
                            </div>

                            <datalist id="variant-color-list">{knownColors.map((c) => <option key={c} value={c} />)}</datalist>
                            <datalist id="variant-size-list">{knownSizes.map((c) => <option key={c} value={c} />)}</datalist>

                            {formData.variants.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
                                    <p>Henüz varyant eklenmedi</p>
                                    <p className="text-sm">Renk/beden seçenekleri için yukarıdan toplu oluşturabilirsiniz</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {variantGroups.map((group) => {
                                        const groupImages = formData.variants[group.idxs[0]]?.images || [];
                                        return (
                                            <div key={`grp-${group.firstIndex}`} className="rounded-lg border bg-gray-50 dark:bg-gray-800/50">
                                                {/* Renk başlığı: ad ve görseller tüm bedenlere uygulanır */}
                                                <div className="space-y-3 border-b p-3">
                                                    <div className="flex flex-wrap items-end gap-2">
                                                        <div className="min-w-0 flex-1 space-y-1">
                                                            <Label className="text-xs">Renk ({group.idxs.length} beden)</Label>
                                                            <Input
                                                                list="variant-color-list"
                                                                value={group.color}
                                                                onChange={(e) => updateVariantGroup(group.idxs, { color: e.target.value })}
                                                                placeholder="Renk (boş bırakılırsa renksiz)"
                                                                className="bg-white dark:bg-gray-900 font-semibold"
                                                            />
                                                        </div>
                                                        <Button type="button" variant="outline" size="sm" onClick={() => addVariantToGroup(group.color)}>
                                                            <Plus className="h-4 w-4 mr-1" /> Beden Ekle
                                                        </Button>
                                                        <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => removeVariantGroup(group.idxs, group.color)}>
                                                            <Trash2 className="h-4 w-4 mr-1" /> Rengi Sil
                                                        </Button>
                                                    </div>
                                                    {formData.images.length > 0 ? (
                                                        <div className="space-y-1">
                                                            <Label className="text-xs">
                                                                Bu rengin görselleri{" "}
                                                                <span className="font-normal text-gray-500">
                                                                    ({groupImages.length > 0 ? `${groupImages.length} seçili` : "seçilmezse ürünün tüm görselleri kullanılır"})
                                                                </span>
                                                            </Label>
                                                            <div className="flex flex-wrap gap-2">
                                                                {formData.images.map((img) => {
                                                                    const selected = groupImages.includes(img);
                                                                    return (
                                                                        <button
                                                                            key={img}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                // Seçim sırası ürün görsel sırasını izler (ilk görsel ana görsel olur)
                                                                                const next = selected ? groupImages.filter((x) => x !== img) : formData.images.filter((x) => x === img || groupImages.includes(x));
                                                                                updateVariantGroup(group.idxs, { images: next });
                                                                            }}
                                                                            className={`relative h-16 w-16 overflow-hidden rounded-md border-2 bg-white ${selected ? "border-blue-600 ring-2 ring-blue-200" : "border-gray-200 opacity-60 hover:opacity-100"}`}
                                                                            title={selected ? "Bu renkten çıkar" : "Bu renge ekle"}
                                                                        >
                                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                            <img src={img} alt="" className="h-full w-full object-contain" />
                                                                            {selected && <span className="absolute right-0.5 top-0.5 rounded-full bg-blue-600 px-1 text-[9px] font-bold text-white">✓</span>}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-gray-500">Renge görsel seçmek için önce Görseller sekmesinden ürün görsellerini yükleyin.</p>
                                                    )}
                                                </div>

                                                {/* Bedenler */}
                                                <div className="divide-y">
                                                    {group.idxs.map((index) => {
                                                        const variant = formData.variants[index];
                                                        const isDup = duplicateVariantKeys.has(variantKey(variant));
                                                        return (
                                                            <div key={index} className={`grid grid-cols-2 gap-2 p-3 md:grid-cols-12 md:items-end ${isDup ? "bg-red-50 dark:bg-red-950/20" : ""} ${variant.isActive === false ? "opacity-60" : ""}`}>
                                                                <div className="space-y-1 md:col-span-2">
                                                                    <Label className="text-[11px]">Beden</Label>
                                                                    <Input list="variant-size-list" value={variant.size} onChange={(e) => updateVariant(index, "size", e.target.value)} placeholder="Beden" className="bg-white dark:bg-gray-900" />
                                                                    {isDup && <p className="text-[10px] font-semibold text-red-600">Bu renk/beden iki kez var</p>}
                                                                </div>
                                                                <div className="space-y-1 md:col-span-1">
                                                                    <Label className="text-[11px]">Stok</Label>
                                                                    <Input type="number" value={variant.stock} onChange={(e) => updateVariant(index, "stock", parseInt(e.target.value) || 0)} className="bg-white dark:bg-gray-900" />
                                                                </div>
                                                                <div className="space-y-1 md:col-span-2">
                                                                    <Label className="text-[11px]">Fiyat Farkı (+/-)</Label>
                                                                    <Input type="number" step="0.01" value={variant.priceAdjustment} onChange={(e) => updateVariant(index, "priceAdjustment", parseFloat(e.target.value) || 0)} className="bg-white dark:bg-gray-900" />
                                                                </div>
                                                                <div className="relative space-y-1 md:col-span-3">
                                                                    <Label className="text-[11px]">Varyant SKU</Label>
                                                                    <Input value={variant.sku} onChange={(e) => updateVariant(index, "sku", e.target.value)} placeholder="SKU" className="bg-white pr-8 dark:bg-gray-900" />
                                                                    <Button type="button" variant="ghost" size="icon" className="absolute bottom-0.5 right-0.5 h-8 w-8" onClick={() => updateVariant(index, "sku", generateSKU())} title="SKU Oluştur">
                                                                        <RefreshCcw className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                                <div className="relative space-y-1 md:col-span-3">
                                                                    <Label className="text-[11px]">Varyant Barkod</Label>
                                                                    <Input value={variant.barcode} onChange={(e) => updateVariant(index, "barcode", e.target.value)} placeholder="Barkod" className="bg-white pr-8 dark:bg-gray-900" />
                                                                    <Button type="button" variant="ghost" size="icon" className="absolute bottom-0.5 right-0.5 h-8 w-8" onClick={() => updateVariant(index, "barcode", generateBarcode())} title="Barkod Oluştur">
                                                                        <RefreshCcw className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                                <div className="col-span-2 flex items-center justify-between gap-2 md:col-span-1 md:flex-col md:items-end">
                                                                    <label className="flex cursor-pointer items-center gap-1.5 text-[11px]" title="Pasif varyant sitede ve pazaryerlerinde satılmaz">
                                                                        <Checkbox checked={variant.isActive !== false} onCheckedChange={(c) => updateVariant(index, "isActive", c === true)} />
                                                                        Aktif
                                                                    </label>
                                                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeVariant(index)} className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-700" title="Bu bedeni sil">
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="media" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Görseller</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-gray-50 transition-colors">
                                <Label htmlFor="image-upload" className="cursor-pointer block">
                                    <div className="flex flex-col items-center gap-2">
                                        <ImageIcon className="h-8 w-8 text-gray-400" />
                                        <span className="text-sm font-medium">Görsel Yüklemek İçin Tıklayın</span>
                                        <span className="text-xs text-gray-500">veya sürükleyip bırakın (Max 5MB)</span>
                                    </div>
                                    <Input
                                        id="image-upload"
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        onChange={handleFileUpload}
                                        disabled={uploading}
                                    />
                                </Label>
                                {uploading && (
                                    <div className="mt-4 flex justify-center text-[#17457C]">
                                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                        <span className="text-sm">Yükleniyor...</span>
                                    </div>
                                )}
                            </div>

                            {formData.images.length > 0 && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                                    {formData.images.map((url, index) => (
                                        <div key={url} className="relative group aspect-square">
                                            <img
                                                src={url}
                                                alt={`Görsel ${index + 1}`}
                                                className="w-full h-full object-cover rounded-lg border bg-white"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeImage(index)}
                                                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full shadow"
                                                title="Görseli sil"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1">
                                                {index === 0 ? (
                                                    <span className="px-2 py-1 bg-[#17457C] text-white text-xs rounded shadow-sm">Ana Görsel</span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => moveImage(index, 0)}
                                                        className="px-2 py-1 bg-white/95 text-[#17457C] border border-[#17457C]/30 text-xs font-medium rounded shadow-sm hover:bg-[#17457C] hover:text-white"
                                                    >
                                                        Ana görsel yap
                                                    </button>
                                                )}
                                                <span className="flex gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => moveImage(index, index - 1)}
                                                        disabled={index === 0}
                                                        className="h-7 w-7 rounded bg-white/95 border text-sm shadow-sm disabled:opacity-30 hover:bg-gray-100"
                                                        title="Sola taşı"
                                                    >
                                                        ‹
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => moveImage(index, index + 1)}
                                                        disabled={index === formData.images.length - 1}
                                                        className="h-7 w-7 rounded bg-white/95 border text-sm shadow-sm disabled:opacity-30 hover:bg-gray-100"
                                                        title="Sağa taşı"
                                                    >
                                                        ›
                                                    </button>
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="settings" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Görünürlük & Etiketler</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Aktif + etiketler tek satırda */}
                            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                {([
                                    { key: "isActive", label: "Aktif", hint: "Mağazada görünür" },
                                    { key: "isFeatured", label: "Öne Çıkan", hint: "Ana sayfa vitrini" },
                                    { key: "isNew", label: "Yeni Ürün", hint: "\"Yeni\" etiketi" },
                                    { key: "isBestSeller", label: "Çok Satan", hint: "\"Çok Satan\" etiketi" },
                                ] as const).map((opt) => (
                                    <label key={opt.key} className="flex items-start gap-2 p-3 border rounded-lg bg-white dark:bg-gray-800 cursor-pointer select-none">
                                        <Checkbox
                                            className="mt-0.5"
                                            checked={Boolean((formData as any)[opt.key])}
                                            onCheckedChange={(c) => handleChange(opt.key, c === true)}
                                        />
                                        <span className="leading-tight">
                                            <span className="block text-sm font-medium">{opt.label}</span>
                                            <span className="block text-[11px] text-muted-foreground">{opt.hint}</span>
                                        </span>
                                    </label>
                                ))}
                            </div>

                            {/* Mağaza Seçimi (Çoklu Mağaza Yapısı) */}
                            <div className="p-4 border rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 space-y-2">
                                <div className="space-y-0.5">
                                    <Label className="text-base font-bold text-emerald-800 dark:text-emerald-300">🏪 Mağaza Yayın Alanı</Label>
                                    <p className="text-sm text-muted-foreground">Bu ürünün hangi web sitesinde / mağazada listeleneceğini seçin.</p>
                                </div>
                                <select
                                    className="w-full h-10 px-3 rounded-md border border-emerald-300 bg-white dark:bg-gray-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    value={formData.store}
                                    onChange={(e) => handleChange("store", e.target.value)}
                                >
                                    <option value="BIKE">🚲 Sadece Bardakcı Bisiklet (bardakcibike.com.tr)</option>
                                    <option value="MOTOR">🏍️ Sadece Motovitrin (motovitrin.com / motor subdomain)</option>
                                    <option value="BOTH">🌐 Her İki Mağazada da Yayınla (Ortak Ürün)</option>
                                </select>
                            </div>

                            <p className="text-xs text-muted-foreground">
                                Pazaryerlerine gönderim seçimi ve fiyatları <strong>Fiyat &amp; Stok</strong> sekmesindedir.
                            </p>

                            <div className="flex flex-wrap items-center justify-between gap-3 p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/10">
                                <div className="space-y-0.5">
                                    <Label className="text-base text-blue-700 dark:text-blue-300">Pazar Yeri Senkronizasyonu</Label>
                                    <p className="text-sm text-muted-foreground">Fiyat ve stok bilgisini şimdi pazar yerlerine gönder.</p>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleMarketplaceSync}
                                    disabled={loading || !product?.id}
                                    className="border-blue-200 hover:bg-blue-100 hover:text-blue-700 dark:border-blue-800 dark:hover:bg-blue-900"
                                >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Şimdi Güncelle
                                </Button>
                            </div>

                            {/* Nadiren kullanılan pazaryeri özel kategori kodları: kapalı gelir, değer girilmişse açık gelir */}
                            <details
                                className="border rounded-lg bg-white dark:bg-gray-800 group"
                                open={Boolean(formData.trendyolCategoryId || formData.n11CategoryId || formData.n11CatalogId || formData.hbCategoryId || formData.idefixCategoryId || formData.pazaramaCategoryId || formData.pttavmCategoryId || formData.ciceksepetiCategoryId)}
                            >
                                <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
                                    Gelişmiş: pazaryeri özel kategori kodları
                                    <span className="block text-[11px] font-normal text-muted-foreground">Boş bırakılırsa site kategorisinin eşleştiği pazaryeri kategorisi kullanılır.</span>
                                </summary>
                                <div className="grid grid-cols-1 gap-3 px-4 pb-4 md:grid-cols-2">
                                    <div className="space-y-1">
                                        <Label htmlFor="trendyolCategoryId" className="text-xs font-semibold text-orange-700">Trendyol Kategori ID</Label>
                                        <Input id="trendyolCategoryId" type="number" value={formData.trendyolCategoryId} onChange={(e) => handleChange("trendyolCategoryId", e.target.value)} placeholder="Örn: 1045" className="h-8 text-xs font-mono" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="n11CategoryId" className="text-xs font-semibold text-purple-700">N11 Kategori ID</Label>
                                        <Input id="n11CategoryId" type="number" value={formData.n11CategoryId} onChange={(e) => handleChange("n11CategoryId", e.target.value)} placeholder="Örn: 100223" className="h-8 text-xs font-mono" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="n11CatalogId" className="text-xs font-semibold text-purple-700">N11 Katalog (Buybox) ID</Label>
                                        <Input
                                            id="n11CatalogId"
                                            type="text"
                                            value={formData.n11CatalogId}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (/^\d*$/.test(val)) {
                                                    handleChange("n11CatalogId", val);
                                                }
                                            }}
                                            placeholder="Örn: 123456789"
                                            className="h-8 text-xs font-mono"
                                        />
                                        <p className="text-[10px] text-muted-foreground">Barkod N11 kuralına (sadece rakam) uymuyorsa ürünü N11 kataloğundaki ürünle eşleştirmek için.</p>
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="hbCategoryId" className="text-xs font-semibold text-orange-700">Hepsiburada Kategori ID</Label>
                                        <Input id="hbCategoryId" type="text" value={formData.hbCategoryId} onChange={(e) => handleChange("hbCategoryId", e.target.value)} placeholder="Kategori ID" className="h-8 text-xs font-mono" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="idefixCategoryId" className="text-xs font-semibold text-purple-700">Idefix Kategori ID</Label>
                                        <Input id="idefixCategoryId" type="text" value={formData.idefixCategoryId} onChange={(e) => handleChange("idefixCategoryId", e.target.value)} placeholder="Örn: 12345" className="h-8 text-xs font-mono" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="pazaramaCategoryId" className="text-xs font-semibold text-pink-700">Pazarama Kategori ID</Label>
                                        <Input id="pazaramaCategoryId" type="text" value={formData.pazaramaCategoryId} onChange={(e) => handleChange("pazaramaCategoryId", e.target.value)} placeholder="Kategori ID" className="h-8 text-xs font-mono" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="pttavmCategoryId" className="text-xs font-semibold text-teal-700">ePttAVM Kategori ID</Label>
                                        <Input id="pttavmCategoryId" type="number" value={formData.pttavmCategoryId} onChange={(e) => handleChange("pttavmCategoryId", e.target.value)} placeholder="Örn: 567" className="h-8 text-xs font-mono" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="ciceksepetiCategoryId" className="text-xs font-semibold text-rose-700">Çiçeksepeti Kategori ID</Label>
                                        <Input id="ciceksepetiCategoryId" type="text" value={formData.ciceksepetiCategoryId} onChange={(e) => handleChange("ciceksepetiCategoryId", e.target.value)} placeholder="Örn: 14604" className="h-8 text-xs font-mono" />
                                    </div>
                                </div>
                            </details>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs >

            {/* Sticky Action Bar */}
            < div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-t z-50 flex items-center justify-end gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] md:pl-64" >
                <Link href="/admin/products">
                    <Button type="button" variant="outline">Vazgeç</Button>
                </Link>
                {!product && (
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={loading}
                        onClick={(e) => {
                            // Enter ile gönderimde tetiklenmesin diye submit değil; formu kendisi gönderir (doğrulama dahil)
                            saveAndNewRef.current = true;
                            e.currentTarget.form?.requestSubmit();
                        }}
                    >
                        Kaydet ve Yeni Ekle
                    </Button>
                )}
                <Button type="submit" disabled={loading} className="min-w-[120px]" onClick={() => { saveAndNewRef.current = false; }}>
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Kaydediliyor
                        </>
                    ) : (
                        product ? "Güncelle" : "Kaydet"
                    )}
                </Button>
            </div >
        </form >
    );
}
