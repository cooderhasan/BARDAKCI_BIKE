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
import { useState, useCallback } from "react";
import Link from "next/link";
import { Plus, X, ImageIcon, Trash2, Loader2, RefreshCcw, Package, RefreshCw, Brain, Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { calculateDesi } from "@/lib/shipping";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { calculateBundleStock } from "@/lib/bundle-utils";


interface Brand {
    id: string;
    name: string;
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
    isBundle?: boolean;
    isTrendyolActive?: boolean;
    isN11Active?: boolean;
    isHepsiburadaActive?: boolean;
    isIdefixActive?: boolean;
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
        store: ((product as any)?.store as "BIKE" | "MOTOR" | "BOTH") || "BIKE",
        isTrendyolActive: product?.isTrendyolActive ?? false,
        isN11Active: product?.isN11Active ?? false,
        isHepsiburadaActive: product?.isHepsiburadaActive ?? false,
        isIdefixActive: (product as any)?.isIdefixActive ?? false,
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
            },
        ]);
    };

    const removeVariant = (index: number) => {
        handleChange("variants", formData.variants.filter((_, i) => i !== index));
    };

    const updateVariant = (index: number, field: keyof ProductVariant, value: string | number | boolean) => {
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const data = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
            if (key === 'variants' || key === 'images' || key === 'categoryIds') {
                data.append(key, JSON.stringify(value));
            } else {
                data.append(key, String(value));
            }
        });

        // Append bundle items if this is a bundle product
        if (formData.isBundle) {
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
                    setTimeout(() => {
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
            toast.error("Kaydetme başarısız");
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
                            <div className="grid gap-4 md:grid-cols-2">
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

                            <div className="grid gap-4 md:grid-cols-2">
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
                                            {brands.map((b) => (
                                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
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
                            <div className="grid gap-4 md:grid-cols-2">
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
                                    <Label htmlFor="trendyolPrice" className="text-orange-600">Trendyol Fiyatı (₺)</Label>
                                    <Input
                                        id="trendyolPrice"
                                        type="number"
                                        step="0.01"
                                        value={formData.trendyolPrice}
                                        onChange={(e) => handleChange("trendyolPrice", e.target.value)}
                                        placeholder="Varsayılan: Liste Fiyatı"
                                        className="border-orange-200 focus:border-orange-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="n11Price" className="text-purple-600">N11 Fiyatı (₺)</Label>
                                    <Input
                                        id="n11Price"
                                        type="number"
                                        step="0.01"
                                        value={formData.n11Price}
                                        onChange={(e) => handleChange("n11Price", e.target.value)}
                                        placeholder="Varsayılan: Liste Fiyatı"
                                        className="border-purple-200 focus:border-purple-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="hepsiburadaPrice" className="text-orange-600">Hepsiburada Fiyatı (₺)</Label>
                                    <Input
                                        id="hepsiburadaPrice"
                                        type="number"
                                        step="0.01"
                                        value={formData.hepsiburadaPrice}
                                        onChange={(e) => handleChange("hepsiburadaPrice", e.target.value)}
                                        placeholder="Varsayılan: Liste Fiyatı"
                                        className="border-orange-200 focus:border-orange-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="idefixPrice" className="text-purple-600">Idefix Fiyatı (₺)</Label>
                                    <Input
                                        id="idefixPrice"
                                        type="number"
                                        step="0.01"
                                        value={formData.idefixPrice}
                                        onChange={(e) => handleChange("idefixPrice", e.target.value)}
                                        placeholder="Varsayılan: Liste Fiyatı"
                                        className="border-purple-200 focus:border-purple-500"
                                    />
                                </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
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

                            <hr />

                            <div className="grid gap-4 md:grid-cols-2">

                                <div className="space-y-2 relative">
                                    <Label htmlFor="sku">Stok Kodu (SKU)</Label>
                                    <Input
                                        id="sku"
                                        value={formData.sku}
                                        onChange={(e) => handleChange("sku", e.target.value)}
                                        placeholder="PRD-001"
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
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="space-y-2">
                                    <Label htmlFor="stock">Stok Adedi</Label>
                                    <Input
                                        id="stock"
                                        type="number"
                                        value={formData.stock}
                                        onChange={(e) => handleChange("stock", e.target.value)}
                                    />
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
                                    <p className="text-xs text-gray-500">Stok bu seviyeye düştüğünde uyarı gösterilir</p>
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

                            <div className="space-y-2">
                                <Label htmlFor="origin">Menşei</Label>
                                <Input
                                    id="origin"
                                    value={formData.origin}
                                    onChange={(e) => handleChange("origin", e.target.value)}
                                    placeholder="Türkiye"
                                />
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
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                                <p className="text-sm text-blue-800 dark:text-blue-200">
                                    <strong>Bilgi:</strong> Desi = (En × Boy × Yükseklik) / 3000. Kargo firmaları ağırlık ve desi değerlerinden büyük olanı baz alır.
                                </p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
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

                            <div className="grid gap-4 md:grid-cols-3">
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
                            <CardTitle>Varyantlar</CardTitle>
                            <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                                <Plus className="h-4 w-4 mr-1" /> Varyant Ekle
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {formData.variants.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
                                    <p>Henüz varyant eklenmedi</p>
                                    <p className="text-sm">Renk/beden seçenekleri için varyant ekleyebilirsiniz</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {formData.variants.map((variant, index) => (
                                        <div key={index} className="border rounded-lg p-4 space-y-4 relative bg-gray-50 dark:bg-gray-800/50">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeVariant(index)}
                                                className="absolute top-2 right-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>

                                            <div className="grid gap-4 md:grid-cols-4">
                                                <div className="space-y-2">
                                                    <Label className="text-xs">Renk</Label>
                                                    <Input
                                                        value={variant.color}
                                                        onChange={(e) => updateVariant(index, "color", e.target.value)}
                                                        placeholder="Renk"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs">Beden</Label>
                                                    <Input
                                                        value={variant.size}
                                                        onChange={(e) => updateVariant(index, "size", e.target.value)}
                                                        placeholder="Beden"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs">Stok</Label>
                                                    <Input
                                                        type="number"
                                                        value={variant.stock}
                                                        onChange={(e) => updateVariant(index, "stock", parseInt(e.target.value) || 0)}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs">Fiyat Farkı (+/-)</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={variant.priceAdjustment}
                                                        onChange={(e) => updateVariant(index, "priceAdjustment", parseFloat(e.target.value) || 0)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid gap-4 md:grid-cols-2">

                                                <div className="space-y-2 relative">
                                                    <Label className="text-xs">Varyant SKU</Label>
                                                    <Input
                                                        value={variant.sku}
                                                        onChange={(e) => updateVariant(index, "sku", e.target.value)}
                                                        placeholder="SKU"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="absolute right-0 top-6 h-8 w-8"
                                                        onClick={() => updateVariant(index, "sku", generateSKU())}
                                                        title="SKU Oluştur"
                                                    >
                                                        <RefreshCcw className="h-3 w-3" />
                                                    </Button>
                                                </div>

                                                <div className="space-y-2 relative">
                                                    <Label className="text-xs">Varyant Barkod</Label>
                                                    <Input
                                                        value={variant.barcode}
                                                        onChange={(e) => updateVariant(index, "barcode", e.target.value)}
                                                        placeholder="Barkod"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="absolute right-0 top-6 h-8 w-8"
                                                        onClick={() => updateVariant(index, "barcode", generateBarcode())}
                                                        title="Barkod Oluştur"
                                                    >
                                                        <RefreshCcw className="h-3 w-3" />
                                                    </Button>

                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent >

                <TabsContent value="bundle" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Package className="h-5 w-5 text-emerald-600" />
                                Paket Ürün Ayarları
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* İsBundle Toggle */}
                            <div className="flex items-center justify-between p-4 border rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800">
                                <div className="space-y-0.5">
                                    <Label className="text-base text-emerald-700 dark:text-emerald-300 font-semibold">📦 Paket Ürün</Label>
                                    <p className="text-sm text-gray-500">Bu ürünü birden fazla ürün içeren bir paket olarak tanımla</p>
                                </div>
                                <Checkbox
                                    checked={formData.isBundle}
                                    onCheckedChange={(c) => handleChange("isBundle", c)}
                                />
                            </div>

                            {formData.isBundle && (
                                <>
                                    {/* Bundle Stock Info */}
                                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Hesaplanan Paket Stoku</p>
                                                <p className="text-xs text-gray-500 mt-1">Paket içindeki en az stoklu ürüne göre otomatik hesaplanır</p>
                                            </div>
                                            <div className="text-right">
                                                <span className={`text-3xl font-bold ${bundleStock > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {bundleItems.length > 0 ? bundleStock : '-'}
                                                </span>
                                                <p className="text-xs text-gray-500">adet paket</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Search Products */}
                                    <div className="space-y-2">
                                        <Label className="font-semibold">Pakete Ürün Ekle</Label>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                            <Input
                                                value={bundleSearchQuery}
                                                onChange={(e) => handleBundleSearch(e.target.value)}
                                                placeholder="Ürün adı, SKU veya barkod ile arayın..."
                                                className="pl-10"
                                            />
                                            {bundleSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />}
                                        </div>

                                        {/* Search Results */}
                                        {bundleSearchResults.length > 0 && (
                                            <div className="border rounded-lg divide-y max-h-60 overflow-y-auto bg-white dark:bg-gray-800 shadow-lg">
                                                {bundleSearchResults.map((item) => (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        onClick={() => addBundleItem(item)}
                                                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                                                    >
                                                        {item.image ? (
                                                            <img src={item.image} alt={item.name} className="w-10 h-10 object-cover rounded border" />
                                                        ) : (
                                                            <div className="w-10 h-10 bg-gray-100 rounded border flex items-center justify-center">
                                                                <Package className="h-5 w-5 text-gray-400" />
                                                            </div>
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate">{item.name}</p>
                                                            <p className="text-xs text-gray-500">{item.sku || '-'} · Stok: {item.stock}</p>
                                                        </div>
                                                        <span className="text-sm font-semibold text-emerald-600 shrink-0">
                                                            {item.salePrice ? item.salePrice.toLocaleString('tr-TR') : item.listPrice.toLocaleString('tr-TR')} ₺
                                                        </span>
                                                        <Plus className="h-4 w-4 text-emerald-600 shrink-0" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Bundle Items List */}
                                    {bundleItems.length === 0 ? (
                                        <div className="text-center py-10 text-gray-500 border-2 border-dashed rounded-lg">
                                            <Package className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                                            <p className="font-medium">Henüz ürün eklenmedi</p>
                                            <p className="text-sm">Yukarıdaki arama alanını kullanarak pakete ürün ekleyebilirsiniz</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <Label className="font-semibold">Paket İçeriği ({bundleItems.length} ürün)</Label>
                                            </div>
                                            <div className="border rounded-lg overflow-hidden">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-gray-50 dark:bg-gray-800">
                                                        <tr>
                                                            <th className="text-left p-3 font-medium">Ürün</th>
                                                            <th className="text-center p-3 font-medium w-28">Adet</th>
                                                            <th className="text-center p-3 font-medium w-24">Stok</th>
                                                            <th className="text-right p-3 font-medium w-28">Fiyat</th>
                                                            <th className="p-3 w-12"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y">
                                                        {bundleItems.map((bi) => (
                                                            <tr key={bi.childProductId} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                                                                <td className="p-3">
                                                                    <div className="flex items-center gap-2">
                                                                        {bi.childProduct.image ? (
                                                                            <img src={bi.childProduct.image} alt="" className="w-8 h-8 object-cover rounded border" />
                                                                        ) : (
                                                                            <div className="w-8 h-8 bg-gray-100 rounded border flex items-center justify-center">
                                                                                <Package className="h-4 w-4 text-gray-400" />
                                                                            </div>
                                                                        )}
                                                                        <div>
                                                                            <p className="font-medium text-sm">{bi.childProduct.name}</p>
                                                                            <p className="text-xs text-gray-500">{bi.childProduct.sku || '-'}</p>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="p-3 text-center">
                                                                    <Input
                                                                        type="number"
                                                                        min="1"
                                                                        value={bi.quantity}
                                                                        onChange={(e) => updateBundleItemQuantity(bi.childProductId, parseInt(e.target.value) || 1)}
                                                                        className="w-20 mx-auto text-center h-8"
                                                                    />
                                                                </td>
                                                                <td className="p-3 text-center">
                                                                    <span className={`font-medium ${bi.childProduct.stock < 5 ? 'text-red-600' : 'text-green-600'}`}>
                                                                        {bi.childProduct.stock}
                                                                    </span>
                                                                </td>
                                                                <td className="p-3 text-right font-medium">
                                                                    {(bi.childProduct.salePrice || bi.childProduct.listPrice).toLocaleString('tr-TR')} ₺
                                                                </td>
                                                                <td className="p-3">
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => removeBundleItem(bi.childProductId)}
                                                                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Bundle Summary */}
                                            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 flex items-center justify-between">
                                                <span className="text-sm text-gray-600">Paket İçerik Toplam Değeri</span>
                                                <span className="text-lg font-bold">
                                                    {bundleItems.reduce((sum, bi) => sum + ((bi.childProduct.salePrice || bi.childProduct.listPrice) * bi.quantity), 0).toLocaleString('tr-TR')} ₺
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </>
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
                                        <div key={index} className="relative group aspect-square">
                                            <img
                                                src={url}
                                                alt={`Görsel ${index + 1}`}
                                                className="w-full h-full object-cover rounded-lg border bg-white"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeImage(index)}
                                                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                            {index === 0 && (
                                                <div className="absolute bottom-2 left-2 px-2 py-1 bg-[#17457C] text-white text-xs rounded shadow-sm">
                                                    Ana Görsel
                                                </div>
                                            )}
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
                            <div className="flex items-center justify-between p-4 border rounded-lg bg-white dark:bg-gray-800">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Aktif Durum</Label>
                                    <p className="text-sm text-muted-foreground">Ürün mağazada görünür olsun mu?</p>
                                </div>
                                <Checkbox
                                    checked={formData.isActive}
                                    onCheckedChange={(c) => handleChange("isActive", c)}
                                />
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

                            <hr />
                            <h3 className="font-semibold text-gray-900 dark:text-white">Pazar Yeri Görünürlüğü</h3>

                            <div className="flex items-center justify-between p-4 border rounded-lg bg-orange-50 dark:bg-orange-900/10">
                                <div className="space-y-0.5">
                                    <Label className="text-base text-orange-700 dark:text-orange-300">Trendyol Satış</Label>
                                    <p className="text-sm text-muted-foreground">Bu ürünü Trendyol'a gönder?</p>
                                </div>
                                <Checkbox
                                    checked={formData.isTrendyolActive}
                                    onCheckedChange={(c) => handleChange("isTrendyolActive", c)}
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 border rounded-lg bg-purple-50 dark:bg-purple-900/10">
                                <div className="space-y-0.5">
                                    <Label className="text-base text-purple-700 dark:text-purple-300">N11 Satış</Label>
                                    <p className="text-sm text-muted-foreground">Bu ürünü N11'e gönder?</p>
                                </div>
                                <Checkbox
                                    checked={formData.isN11Active}
                                    onCheckedChange={(c) => handleChange("isN11Active", c)}
                                />
                            </div>

                            {formData.isN11Active && (
                                <div className="p-4 border border-purple-200 dark:border-purple-800 rounded-lg bg-purple-50/30 dark:bg-purple-950/10 space-y-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="n11CatalogId" className="text-purple-700 dark:text-purple-300 font-semibold flex items-center gap-1.5">
                                            <span>N11 Katalog (Buybox) ID</span>
                                        </Label>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            Eğer ürün barkodu N11 kurallarına (sadece numerik olması gerekir) uymuyorsa, ürünü N11 kataloğundaki bir ürünle eşleştirmek için N11 Katalog ID'sini girebilirsiniz.
                                        </p>
                                        <Input
                                            id="n11CatalogId"
                                            type="text"
                                            value={formData.n11CatalogId}
                                            onChange={(e) => {
                                                // Only allow numbers
                                                const val = e.target.value;
                                                if (/^\d*$/.test(val)) {
                                                    handleChange("n11CatalogId", val);
                                                }
                                            }}
                                            placeholder="Örn: 123456789"
                                            className="border-purple-200 dark:border-purple-800 focus:border-purple-500 bg-white dark:bg-gray-800 font-mono"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-between p-4 border rounded-lg bg-orange-50 dark:bg-orange-900/10">
                                <div className="space-y-0.5">
                                    <Label className="text-base text-orange-700 dark:text-orange-300">Hepsiburada Satış</Label>
                                    <p className="text-sm text-muted-foreground">Bu ürünü Hepsiburada'ya gönder?</p>
                                </div>
                                <Checkbox
                                    checked={formData.isHepsiburadaActive}
                                    onCheckedChange={(c) => handleChange("isHepsiburadaActive", c)}
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 border rounded-lg bg-purple-50 dark:bg-purple-900/10">
                                <div className="space-y-0.5">
                                    <Label className="text-base text-purple-700 dark:text-purple-300">Idefix Satış</Label>
                                    <p className="text-sm text-muted-foreground">Bu ürünü Idefix'e gönder?</p>
                                </div>
                                <Checkbox
                                    checked={formData.isIdefixActive}
                                    onCheckedChange={(c) => handleChange("isIdefixActive", c)}
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/10">
                                <div className="space-y-0.5">
                                    <Label className="text-base text-blue-700 dark:text-blue-300">🛒 Google Shopping Feed</Label>
                                    <p className="text-sm text-muted-foreground">Bu ürünü Google Merchant Center feed'ine ekle?</p>
                                </div>
                                <Checkbox
                                    checked={formData.isGoogleActive}
                                    onCheckedChange={(c) => handleChange("isGoogleActive", c)}
                                />
                            </div>

                            {formData.isGoogleActive && (
                                <div className="p-4 border border-blue-200 rounded-lg bg-blue-50/50 space-y-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="googlePrice" className="text-blue-700">Google Fiyatı (₺) <span className="font-normal text-gray-500">— Boş bırakılırsa liste fiyatı kullanılır</span></Label>
                                        <Input
                                            id="googlePrice"
                                            type="number"
                                            step="0.01"
                                            value={formData.googlePrice}
                                            onChange={(e) => handleChange("googlePrice", e.target.value)}
                                            placeholder="Varsayılan: Liste Fiyatı"
                                            className="border-blue-200 focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/10 mt-4">
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

                            <div className="flex items-center justify-between p-4 border rounded-lg bg-white dark:bg-gray-800">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Öne Çıkan</Label>
                                    <p className="text-sm text-muted-foreground">Ana sayfada vitrine eklensin mi?</p>
                                </div>
                                <Checkbox
                                    checked={formData.isFeatured}
                                    onCheckedChange={(c) => handleChange("isFeatured", c)}
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 border rounded-lg bg-white dark:bg-gray-800">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Yeni Ürün</Label>
                                    <p className="text-sm text-muted-foreground">"Yeni" etiketi gösterilsin mi?</p>
                                </div>
                                <Checkbox
                                    checked={formData.isNew}
                                    onCheckedChange={(c) => handleChange("isNew", c)}
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 border rounded-lg bg-white dark:bg-gray-800">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Çok Satan</Label>
                                    <p className="text-sm text-muted-foreground">"Çok Satan" etiketi gösterilsin mi?</p>
                                </div>
                                <Checkbox
                                    checked={formData.isBestSeller}
                                    onCheckedChange={(c) => handleChange("isBestSeller", c)}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs >

            {/* Sticky Action Bar */}
            < div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-t z-50 flex items-center justify-end gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] md:pl-64" >
                <Link href="/admin/products">
                    <Button type="button" variant="outline">Vazgeç</Button>
                </Link>
                <Button type="submit" disabled={loading} className="min-w-[120px]">
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
