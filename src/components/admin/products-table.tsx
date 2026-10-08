"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Edit, MoreHorizontal, Trash, Star, Sparkles, TrendingUp, Search, Upload, Download, ExternalLink, Package, RefreshCw } from "lucide-react";
import { formatPrice } from "@/lib/helpers";
import { deleteProduct, toggleProductStatus, toggleTrendyolStatus, toggleN11Status, toggleHepsiburadaStatus, toggleProductFeature } from "@/app/admin/(protected)/products/actions";
import { syncProductsToHepsiburada } from "@/app/admin/(protected)/integrations/hepsiburada/actions";
import { toast } from "sonner";

interface Product {
    id: string;
    name: string;
    slug: string;
    sku: string | null;
    barcode: string | null;
    listPrice: number;
    vatRate: number;
    minQuantity: number;
    stock: number;
    isFeatured: boolean;
    isNew: boolean;
    isBestSeller: boolean;
    isActive: boolean;
    isTrendyolActive: boolean;
    isN11Active: boolean;
    isHepsiburadaActive?: boolean;
    isBundle?: boolean;
    images?: string[];
    store?: "BIKE" | "MOTOR" | "BOTH";
    categories: {
        id: string;
        name: string;
    }[];
    brand: {
        id: string;
        name: string;
    } | null;
}

interface Brand {
    id: string;
    name: string;
}

interface ProductsTableProps {
    products: Product[];
    brands: Brand[];
    pagination?: {
        currentPage: number;
        totalPages: number;
        totalCount: number;
    };
}

const stockStatusOptions = [
    { value: "ALL", label: "Tümü" },
    { value: "IN_STOCK", label: "Stokta Var" },
    { value: "OUT_OF_STOCK", label: "Tükendi" },
];

const priceStatusOptions = [
    { value: "ALL", label: "Tümü" },
    { value: "NO_PRICE", label: "Fiyatsız" },
    { value: "HAS_PRICE", label: "Fiyatlı" },
];

const featureOptions = [
    { value: "ALL", label: "Tümü" },
    { value: "featured", label: "Öne Çıkanlar" },
    { value: "new", label: "Yeni Ürünler" },
    { value: "bestseller", label: "Çok Satanlar" },
    { value: "discounted", label: "İndirimli Ürünler" },
];

export function ProductsTable({ products: initialProducts, brands, pagination }: ProductsTableProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Filter States
    const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
    const [brandFilter, setBrandFilter] = useState(searchParams.get("brand") || "ALL");
    const [storeFilter, setStoreFilter] = useState(searchParams.get("store") || "ALL");
    const [stockStatus, setStockStatus] = useState(searchParams.get("stockStatus") || "ALL");
    const [priceStatus, setPriceStatus] = useState(searchParams.get("priceStatus") || "ALL");
    const [featureFilter, setFeatureFilter] = useState(searchParams.get("feature") || "ALL");

    const [products, setProducts] = useState(initialProducts);

    useEffect(() => {
        setProducts(initialProducts);
    }, [initialProducts]);
    const [loading, setLoading] = useState<string | null>(null);
    const [loadingFeature, setLoadingFeature] = useState<string | null>(null);
    const [hbSyncing, setHbSyncing] = useState<string | null>(null);

    // Sync local product state when props change
    useEffect(() => {
        setProducts(initialProducts);
    }, [initialProducts]);

    // Apply Filters
    const applyFilters = () => {
        const params = new URLSearchParams(searchParams.toString());

        if (searchTerm) params.set("search", searchTerm);
        else params.delete("search");

        if (brandFilter && brandFilter !== "ALL") params.set("brand", brandFilter);
        else params.delete("brand");

        if (storeFilter && storeFilter !== "ALL") params.set("store", storeFilter);
        else params.delete("store");

        if (stockStatus && stockStatus !== "ALL") params.set("stockStatus", stockStatus);
        else params.delete("stockStatus");

        if (priceStatus && priceStatus !== "ALL") params.set("priceStatus", priceStatus);
        else params.delete("priceStatus");

        if (featureFilter && featureFilter !== "ALL") params.set("feature", featureFilter);
        else params.delete("feature");

        params.set("page", "1");
        router.push(`?${params.toString()}`);
    };

    // Reset Filters
    const resetFilters = () => {
        setSearchTerm("");
        setBrandFilter("ALL");
        setStockStatus("ALL");
        setPriceStatus("ALL");
        setFeatureFilter("ALL");
        router.push("/admin/products");
    };

    // Handle Pagination
    const handlePageChange = (newPage: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("page", newPage.toString());
        router.push(`?${params.toString()}`);
    };

    const handleDelete = async (productId: string) => {
        if (!confirm("Bu ürünü silmek istediğinize emin misiniz?")) return;

        setLoading(productId);
        try {
            await deleteProduct(productId);
            toast.success("Ürün silindi.");
            setProducts(prev => prev.filter(p => p.id !== productId));
        } catch {
            toast.error("Bir hata oluştu.");
        } finally {
            setLoading(null);
        }
    };

    const handleToggleStatus = async (productId: string, isActive: boolean) => {
        try {
            await toggleProductStatus(productId, !isActive);
            toast.success(isActive ? "Ürün pasif yapıldı." : "Ürün aktif yapıldı.");
            setProducts(prev => prev.map(p =>
                p.id === productId ? { ...p, isActive: !isActive } : p
            ));
        } catch {
            toast.error("Bir hata oluştu.");
        }
    };

    const handleToggleTrendyolStatus = async (productId: string, isTrendyolActive: boolean) => {
        try {
            await toggleTrendyolStatus(productId, !isTrendyolActive);
            toast.success(!isTrendyolActive ? "Ürün Trendyol'da satışa açıldı." : "Ürün Trendyol'da satışa kapatıldı.");
            setProducts(prev => prev.map(p =>
                p.id === productId ? { ...p, isTrendyolActive: !isTrendyolActive } : p
            ));
        } catch {
            toast.error("İşlem sırasında bir hata oluştu.");
        }
    };

    const handleToggleN11Status = async (productId: string, isN11Active: boolean) => {
        try {
            await toggleN11Status(productId, !isN11Active);
            toast.success(!isN11Active ? "Ürün N11'de satışa açıldı." : "Ürün N11'de satışa kapatıldı.");
            setProducts(prev => prev.map(p =>
                p.id === productId ? { ...p, isN11Active: !isN11Active } : p
            ));
        } catch {
            toast.error("İşlem sırasında bir hata oluştu.");
        }
    };

    const handleToggleHepsiburadaStatus = async (productId: string, isHepsiburadaActive: boolean) => {
        try {
            await toggleHepsiburadaStatus(productId, !isHepsiburadaActive);
            toast.success(!isHepsiburadaActive ? "Ürün Hepsiburada'da satışa açıldı." : "Ürün Hepsiburada'da satışa kapatıldı.");
            setProducts(prev => prev.map(p =>
                p.id === productId ? { ...p, isHepsiburadaActive: !isHepsiburadaActive } : p
            ));
        } catch {
            toast.error("İşlem sırasında bir hata oluştu.");
        }
    };

    const handleToggleFeature = async (productId: string, feature: "isFeatured" | "isNew" | "isBestSeller", currentValue: boolean) => {
        const loadingKey = `${productId}-${feature}`;
        setLoadingFeature(loadingKey);
        try {
            const result = await toggleProductFeature(productId, feature, !currentValue);
            if (result.success) {
                toast.success("Ürün özelliği güncellendi.");
                setProducts(prev => prev.map(p =>
                    p.id === productId ? { ...p, [feature]: !currentValue } : p
                ));
            } else {
                toast.error("İşlem sırasında bir hata oluştu.");
            }
        } catch {
            toast.error("İşlem sırasında bir hata oluştu.");
        } finally {
            setLoadingFeature(null);
        }
    };

    const handleHepsiburadaSync = async (productId: string) => {
        setHbSyncing(productId);
        try {
            const result = await syncProductsToHepsiburada([productId]);
            if (result.success) {
                toast.success(result.message || "Hepsiburada'ya gönderildi!");
            } else {
                toast.error(result.message || "Hepsiburada sync hatası.");
            }
        } catch {
            toast.error("Hepsiburada bağlantısında bir hata oluştu.");
        } finally {
            setHbSyncing(null);
        }
    };

    // Masaüstü tablo ve mobil kart aynı menüyü kullanır; mobilde pazaryeri aç/kapa da menüde yer alır
    const renderActionsMenu = (product: Product, includeMarketplaces = false) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" disabled={loading === product.id}>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                    <Link href={`/admin/products/${product.id}/edit`} prefetch={true}>
                        <Edit className="h-4 w-4 mr-2" />
                        Düzenle
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link href={`/products/${product.slug}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Görüntüle
                    </Link>
                </DropdownMenuItem>
                {includeMarketplaces && (
                    <>
                        <DropdownMenuItem onClick={() => handleToggleTrendyolStatus(product.id, product.isTrendyolActive)}>
                            <RefreshCw className="h-4 w-4 mr-2 text-orange-600" />
                            {product.isTrendyolActive ? "Trendyol'da Satışa Kapat" : "Trendyol'da Satışa Aç"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleN11Status(product.id, product.isN11Active)}>
                            <RefreshCw className="h-4 w-4 mr-2 text-[#17457C]" />
                            {product.isN11Active ? "N11'de Satışa Kapat" : "N11'de Satışa Aç"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleHepsiburadaStatus(product.id, !!product.isHepsiburadaActive)}>
                            <RefreshCw className="h-4 w-4 mr-2 text-red-600" />
                            {product.isHepsiburadaActive ? "Hepsiburada'da Satışa Kapat" : "Hepsiburada'da Satışa Aç"}
                        </DropdownMenuItem>
                    </>
                )}
                {product.isHepsiburadaActive && (
                    <DropdownMenuItem
                        onClick={() => handleHepsiburadaSync(product.id)}
                        disabled={hbSyncing === product.id}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${hbSyncing === product.id ? 'animate-spin' : ''}`} />
                        HB Fiyat/Stok Güncelle
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => handleToggleStatus(product.id, product.isActive)}>
                    {product.isActive ? "Pasif Yap" : "Aktif Yap"}
                </DropdownMenuItem>
                <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(product.id)}>
                    <Trash className="h-4 w-4 mr-2" />
                    Sil
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );

    const featureToggles = [
        { key: "isFeatured" as const, Icon: Star, on: "text-yellow-500 fill-yellow-500", hover: "hover:text-yellow-500", titleOn: "Öne Çıkarılanlardan Kaldır", titleOff: "Öne Çıkanlara Ekle" },
        { key: "isNew" as const, Icon: Sparkles, on: "text-blue-500 fill-blue-500", hover: "hover:text-blue-500", titleOn: "Yeni Ürün Etiketini Kaldır", titleOff: "Yeni Ürün Olarak İşaretle" },
        { key: "isBestSeller" as const, Icon: TrendingUp, on: "text-green-500", hover: "hover:text-green-500", titleOn: "Çok Satanlardan Kaldır", titleOff: "Çok Satanlara Ekle" },
    ];

    const featureButtons = (product: Product) =>
        featureToggles.map(({ key, Icon, on, hover, titleOn, titleOff }) => {
            const active = product[key];
            const isLoading = loadingFeature === `${product.id}-${key}`;
            return (
                <button
                    key={key}
                    onClick={() => handleToggleFeature(product.id, key, active)}
                    disabled={isLoading}
                    className={`p-1.5 rounded hover:bg-gray-100 transition-colors flex items-center justify-center ${isLoading ? "opacity-50 pointer-events-none" : ""}`}
                    title={active ? titleOn : titleOff}
                >
                    <Icon className={`h-4 w-4 transition-colors ${active ? on : `text-gray-300 ${hover}`}`} />
                </button>
            );
        });

    const storeBadge = (store?: Product["store"]) =>
        store === "MOTOR" ? (
            <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">🏍️ Motor</span>
        ) : store === "BOTH" ? (
            <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">🌐 Ortak</span>
        ) : (
            <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">🚲 Bisiklet</span>
        );

    const marketplaceChip = (label: string, active: boolean | undefined, activeClass: string) => (
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${active ? activeClass : "bg-gray-100 text-gray-400 line-through"}`}>
            {label}
        </span>
    );

    return (
        <div className="space-y-4">
            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-gray-500">
                    {pagination && `${pagination.totalCount} ürün`}
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link href="/api/products/export">
                        <Button variant="outline" size="sm">
                            <Download className="h-4 w-4 mr-2" />
                            Excel'e Aktar
                        </Button>
                    </Link>
                    <Link href="/admin/products/import">
                        <Button variant="outline" size="sm">
                            <Upload className="h-4 w-4 mr-2" />
                            Toplu Yükle
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-gray-900 p-3 sm:p-4 rounded-lg shadow border border-gray-100 dark:border-gray-800">
                <div className="grid grid-cols-2 gap-3 md:flex md:flex-row md:items-end md:gap-4">
                    {/* Search */}
                    <div className="col-span-2 flex-1 md:min-w-[200px] space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Arama</label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Ürün Adı, SKU, Barkod..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                                className="pl-9"
                            />
                        </div>
                    </div>

                    {/* Brand */}
                    <div className="min-w-0 w-full md:w-[180px] space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Marka</label>
                        <Select value={brandFilter} onValueChange={setBrandFilter}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Tümü" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Tümü</SelectItem>
                                {brands.map((brand) => (
                                    <SelectItem key={brand.id} value={brand.id}>
                                        {brand.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Mağaza Filtresi */}
                    <div className="min-w-0 w-full md:w-[180px] space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Mağaza</label>
                        <Select value={storeFilter} onValueChange={setStoreFilter}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Tümü" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Tümü</SelectItem>
                                <SelectItem value="BIKE">🚲 Bardakcı Bisiklet</SelectItem>
                                <SelectItem value="MOTOR">🏍️ Motovitrin</SelectItem>
                                <SelectItem value="BOTH">🌐 Ortak Ürünler</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Stock Status */}
                    <div className="min-w-0 w-full md:w-[180px] space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Stok Durumu</label>
                        <Select value={stockStatus} onValueChange={setStockStatus}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Tümü" />
                            </SelectTrigger>
                            <SelectContent>
                                {stockStatusOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Price Status */}
                    <div className="min-w-0 w-full md:w-[180px] space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Fiyat Durumu</label>
                        <Select value={priceStatus} onValueChange={setPriceStatus}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Tümü" />
                            </SelectTrigger>
                            <SelectContent>
                                {priceStatusOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Ürün Özelliği */}
                    <div className="col-span-2 min-w-0 w-full md:w-[180px] space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Ürün Özelliği</label>
                        <Select value={featureFilter} onValueChange={setFeatureFilter}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Tümü" />
                            </SelectTrigger>
                            <SelectContent>
                                {featureOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Actions */}
                    <div className="col-span-2 flex items-end gap-2 md:ml-auto w-full md:w-auto">
                        <Button onClick={resetFilters} variant="ghost" className="flex-1 md:flex-none text-gray-500 hover:text-gray-700">
                            Temizle
                        </Button>
                        <Button onClick={applyFilters} className="flex-1 md:flex-none min-w-[100px]">
                            Filtrele
                        </Button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-lg border bg-white dark:bg-gray-800 shadow">
                {/* Mobil: kart listesi */}
                <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
                    {products.length === 0 ? (
                        <p className="text-center py-8 text-gray-500">Ürün bulunamadı.</p>
                    ) : (
                        products.map((product) => (
                            <div key={product.id} className="p-3 flex gap-3">
                                <div className="shrink-0 w-16 h-16 rounded-md bg-gray-50 dark:bg-gray-900 border overflow-hidden flex items-center justify-center">
                                    {product.images?.[0] ? (
                                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-contain" loading="lazy" />
                                    ) : (
                                        <Package className="h-6 w-6 text-gray-300" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 space-y-1.5">
                                    <div className="flex items-start gap-1">
                                        <Link
                                            href={`/admin/products/${product.id}/edit`}
                                            className="flex-1 min-w-0 text-sm font-medium leading-snug line-clamp-2 hover:text-[#17457C]"
                                        >
                                            {product.name}
                                        </Link>
                                        <div className="-mt-1 -mr-2 shrink-0">{renderActionsMenu(product, true)}</div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                                        {storeBadge(product.store)}
                                        {product.isBundle && (
                                            <span className="inline-flex items-center gap-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                                <Package className="h-3 w-3" />
                                                Paket
                                            </span>
                                        )}
                                        {product.brand?.name && <span className="truncate max-w-[120px]">{product.brand.name}</span>}
                                        {product.sku && <span className="font-mono truncate max-w-[140px]">{product.sku}</span>}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-semibold text-sm">{formatPrice(Number(product.listPrice))}</span>
                                        <Badge variant={product.stock > 10 ? "default" : "destructive"} className="text-[11px]">
                                            Stok: {product.stock}
                                        </Badge>
                                        <Badge
                                            variant={product.isActive ? "default" : "secondary"}
                                            className={`text-[11px] ${product.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                                        >
                                            {product.isActive ? "Aktif" : "Pasif"}
                                        </Badge>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex flex-wrap gap-1">
                                            {marketplaceChip("Trendyol", product.isTrendyolActive, "bg-orange-100 text-orange-800")}
                                            {marketplaceChip("N11", product.isN11Active, "bg-blue-100 text-blue-800")}
                                            {marketplaceChip("HB", product.isHepsiburadaActive, "bg-red-100 text-red-800")}
                                        </div>
                                        <div className="flex -mr-1.5">{featureButtons(product)}</div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="hidden md:block overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Ürün</TableHead>
                                <TableHead>Kategori</TableHead>
                                <TableHead>Marka</TableHead>
                                <TableHead>SKU/Barkod</TableHead>
                                <TableHead>Liste Fiyatı</TableHead>
                                <TableHead>Stok</TableHead>
                                <TableHead>Trendyol</TableHead>
                                <TableHead>N11</TableHead>
                                <TableHead>HB</TableHead>
                                <TableHead>Durum</TableHead>
                                <TableHead className="text-right">İşlemler</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {products.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                                        Ürün bulunamadı.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                products.map((product) => (
                                    <TableRow key={product.id}>
                                        <TableCell className="whitespace-normal min-w-[200px] max-w-[450px]">
                                            <div className="flex items-center gap-2">
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Link 
                                                            href={`/products/${product.slug}`} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="font-medium hover:text-[#17457C] transition-colors"
                                                        >
                                                            {product.name}
                                                        </Link>
                                                        {(product as any).isBundle && (
                                                            <span className="inline-flex items-center gap-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                                                <Package className="h-3 w-3" />
                                                                Paket
                                                            </span>
                                                        )}
                                                        {(product as any).store === "MOTOR" ? (
                                                            <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                                🏍️ Motor
                                                            </span>
                                                        ) : (product as any).store === "BOTH" ? (
                                                            <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                                🌐 Ortak
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                                🚲 Bisiklet
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-1 mt-1.5 items-center">{featureButtons(product)}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                         <TableCell>
                                            {product.categories && product.categories.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {product.categories.map((cat) => (
                                                        <span key={cat.id} className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                                                            {cat.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {product.brand?.name || (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                <div>{product.sku || "-"}</div>
                                                <div className="text-gray-500 text-xs flex items-center gap-2">
                                                    {product.barcode || "-"}
                                                    {product.isTrendyolActive && !product.barcode && (
                                                        <span className="bg-red-100 text-red-600 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold" title="Trendyol için barkod zorunludur!">
                                                            ⚠️ BARKOD EKSİK
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>{formatPrice(Number(product.listPrice))}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={product.stock > 10 ? "default" : "destructive"}
                                            >
                                                {product.stock}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant={product.isTrendyolActive ? "default" : "secondary"}
                                                    className={
                                                        product.isTrendyolActive
                                                            ? "bg-orange-100 text-orange-800"
                                                            : "bg-gray-100 text-gray-800"
                                                    }
                                                >
                                                    {product.isTrendyolActive ? "Açık" : "Kapalı"}
                                                </Badge>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                                    onClick={() => handleToggleTrendyolStatus(product.id, product.isTrendyolActive)}
                                                    title={product.isTrendyolActive ? "Trendyolda Satışa Kapat" : "Trendyolda Satışa Aç"}
                                                >
                                                    <RefreshCw className={`h-4 w-4 ${loading === product.id ? 'animate-spin' : ''}`} />
                                                </Button>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant={product.isN11Active ? "default" : "secondary"}
                                                    className={
                                                        product.isN11Active
                                                            ? "bg-blue-100 text-blue-800"
                                                            : "bg-gray-100 text-gray-800"
                                                    }
                                                >
                                                    {product.isN11Active ? "Açık" : "Kapalı"}
                                                </Badge>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-[#17457C] hover:text-blue-700 hover:bg-blue-50"
                                                    onClick={() => handleToggleN11Status(product.id, product.isN11Active)}
                                                    title={product.isN11Active ? "N11'de Satışa Kapat" : "N11'de Satışa Aç"}
                                                >
                                                    <RefreshCw className={`h-4 w-4 ${loading === product.id ? 'animate-spin' : ''}`} />
                                                </Button>
                                            </div>
                                        </TableCell>
                                        {/* Hepsiburada Sync */}
                                         <TableCell>
                                             <div className="flex items-center gap-2">
                                                 <Badge
                                                     variant={(product as any).isHepsiburadaActive ? "default" : "secondary"}
                                                     className={
                                                         (product as any).isHepsiburadaActive
                                                             ? "bg-red-100 text-red-800"
                                                             : "bg-gray-100 text-gray-800"
                                                     }
                                                 >
                                                     {(product as any).isHepsiburadaActive ? "Açık" : "Kapalı"}
                                                 </Badge>
                                                 <Button
                                                     variant="ghost"
                                                     size="icon"
                                                     className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                     onClick={() => handleToggleHepsiburadaStatus(product.id, !!(product as any).isHepsiburadaActive)}
                                                     title={(product as any).isHepsiburadaActive ? "Hepsiburada'da Satışa Kapat" : "Hepsiburada'da Satışa Aç"}
                                                 >
                                                     <RefreshCw className="h-4 w-4" />
                                                 </Button>
                                                 {(product as any).isHepsiburadaActive && (
                                                     <Button
                                                         variant="ghost"
                                                         size="icon"
                                                         className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                                         onClick={() => handleHepsiburadaSync(product.id)}
                                                         disabled={hbSyncing === product.id}
                                                         title="Hepsiburada Fiyat/Stok Anlık Güncelle"
                                                     >
                                                         <RefreshCw className={`h-4 w-4 ${hbSyncing === product.id ? 'animate-spin' : ''}`} />
                                                     </Button>
                                                 )}
                                             </div>
                                         </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={product.isActive ? "default" : "secondary"}
                                                className={
                                                    product.isActive
                                                        ? "bg-green-100 text-green-800"
                                                        : "bg-gray-100 text-gray-800"
                                                }
                                            >
                                                {product.isActive ? "Aktif" : "Pasif"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {renderActionsMenu(product)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination Controls */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 sm:p-4 border-t">
                        <div className="text-sm text-gray-500 text-center">
                            Toplam {pagination.totalCount} ürün, Sayfa {pagination.currentPage} / {pagination.totalPages}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(pagination.currentPage - 1)}
                                disabled={pagination.currentPage <= 1}
                            >
                                Önceki
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(pagination.currentPage + 1)}
                                disabled={pagination.currentPage >= pagination.totalPages}
                            >
                                Sonraki
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
