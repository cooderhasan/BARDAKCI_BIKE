"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ProductCardV2 } from "./product-card-v2";
import { formatPrice, calculatePrice, validateMinQuantity } from "@/lib/helpers";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/stores/cart-store";
import { toast } from "sonner";
import { useState } from "react";
import { ShoppingCart, Minus, Plus, Package, Truck, ChevronLeft, ChevronRight, Shield, CreditCard, ChevronRight as ChevronRightIcon, FileText, Star } from "lucide-react";
import { InstallmentTable } from "./installment-table";
import { WishlistButton } from "@/components/products/wishlist-button";
import { ReviewForm } from "@/components/products/review-form";
import { ReviewList } from "@/components/products/review-list";
import { ShippingInfoBanner } from "./shipping-info-banner";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";

interface ProductVariant {
    id: string;
    color: string | null;
    size: string | null;
    stock: number;
    sku: string | null;
    barcode: string | null;
    priceAdjustment: number;
}

interface Product {
    id: string;
    name: string;
    slug: string;
    images: string[];
    listPrice: number;
    salePrice?: number | null;
    vatRate: number;
    minQuantity: number;
    stock: number;
    sku: string | null;
    barcode: string | null;
    origin: string | null;
    description: string | null;
    weight?: number | null;
    width?: number | null;
    height?: number | null;
    length?: number | null;
    desi?: number | null;
    categories: {
        id: string;
        name: string;
        slug: string;
        parent?: {
            id: string;
            name: string;
            slug: string;
            parent?: {
                id: string;
                name: string;
                slug: string;
            } | null;
        } | null;
    }[];
    category?: {
        id: string;
        name: string;
        slug: string;
    } | null;
    brand?: {
        name: string;
        slug: string;
    } | null;
    variants?: ProductVariant[];
}

interface Review {
    id: string;
    rating: number;
    comment: string | null;
    createdAt: Date;
    user: {
        name: string | null;
        image: string | null;
    };
}

interface ProductDetailProps {
    product: Product;
    relatedProducts: Product[];
    discountRate: number;
    isDealer: boolean;
    isAuthenticated: boolean;
    whatsappNumber?: string;
    reviews: Review[];
    reviewStats: {
        averageRating: number;
        totalReviews: number;
    };
}

export function ProductDetail({
    product,
    relatedProducts,
    discountRate,
    isDealer,
    isAuthenticated,
    whatsappNumber,
    reviews,
    reviewStats,
}: ProductDetailProps) {
    const [quantity, setQuantity] = useState(product.minQuantity);
    const [inputValue, setInputValue] = useState(product.minQuantity.toString());
    const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const addItem = useCartStore((state) => state.addItem);

    // Get unique colors and sizes from variants
    const variants = product.variants || [];
    const colors = [...new Set(variants.filter(v => v.color).map(v => v.color!))];
    const sizes = [...new Set(variants.filter(v => v.size).map(v => v.size!))];
    const hasVariants = variants.length > 0;

    // Selected color and size
    const [selectedColor, setSelectedColor] = useState<string | null>(colors.length > 0 ? colors[0] : null);
    const [selectedSize, setSelectedSize] = useState<string | null>(sizes.length > 0 ? sizes[0] : null);

    // Find matching variant based on selection
    const findVariant = () => {
        if (!hasVariants) return null;
        return variants.find(v => {
            const colorMatch = !colors.length || v.color === selectedColor;
            const sizeMatch = !sizes.length || v.size === selectedSize;
            return colorMatch && sizeMatch;
        }) || null;
    };

    // Update selected variant when color/size changes
    const currentVariant = findVariant();
    const effectiveStock = hasVariants ? (currentVariant?.stock || 0) : product.stock;
    const priceAdjustment = currentVariant?.priceAdjustment || 0;

    const price = calculatePrice(
        product.listPrice + priceAdjustment,
        product.salePrice, // Pass salePrice
        discountRate,
        product.vatRate
    );

    const baseSalePrice = product.salePrice;
    const hasSalePrice = baseSalePrice != null && baseSalePrice < product.listPrice;
    const effectiveSalePrice = hasSalePrice ? (baseSalePrice! + priceAdjustment) : null;
    const saleDiscountRate = hasSalePrice && baseSalePrice != null
        ? Math.round(((product.listPrice - baseSalePrice) / product.listPrice) * 100)
        : 0;

    const displayFinalPrice = hasSalePrice ? effectiveSalePrice! : (isDealer ? price.finalPrice : (product.listPrice + priceAdjustment));
    const showStrikethrough = hasSalePrice || (isDealer && discountRate > 0);
    const strikethroughPrice = product.listPrice + priceAdjustment;

    const vatAmount = hasSalePrice
        ? (displayFinalPrice - (displayFinalPrice / (1 + product.vatRate / 100)))
        : price.vatAmount;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInputValue(value);
        const numValue = Number(value);
        if (!isNaN(numValue) && numValue >= 0) {
            setQuantity(numValue);
        }
    };

    const handleInputBlur = () => {
        let numValue = Number(inputValue);
        if (isNaN(numValue)) numValue = product.minQuantity;
        if (numValue < product.minQuantity) numValue = product.minQuantity;
        if (numValue > effectiveStock) numValue = effectiveStock;
        setQuantity(numValue);
        setInputValue(numValue.toString());
    };

    const adjustQuantity = (delta: number) => {
        const newValue = quantity + delta;
        if (newValue >= product.minQuantity && newValue <= effectiveStock) {
            setQuantity(newValue);
            setInputValue(newValue.toString());
        }
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select();
    };

    const handleAddToCart = () => {
        const validation = validateMinQuantity(quantity, product.minQuantity);
        if (!validation.valid) {
            toast.error(validation.message);
            return;
        }
        if (quantity > effectiveStock) {
            toast.error(`Stokta sadece ${effectiveStock} adet bulunuyor.`);
            return;
        }
        if (hasVariants && !currentVariant) {
            toast.error("Lütfen bir varyant seçin.");
            return;
        }
        const variantInfo = currentVariant ?
            [selectedColor && `Renk: ${selectedColor}`, selectedSize && `Beden: ${selectedSize}`]
                .filter(Boolean).join(", ") : undefined;

        // Calculate effective desi
        const dimsDesi = (Number(product.width || 0) * Number(product.height || 0) * Number(product.length || 0)) / 3000;
        const effectiveDesi = Math.max(Number(product.weight || 0), Number(product.desi || 0), dimsDesi);

        // Calculate exact discount percentage for cart
        const exactSaleDiscountRate = product.salePrice
            ? ((product.listPrice - product.salePrice) / product.listPrice) * 100
            : 0;

        addItem({
            productId: product.id,
            name: product.name,
            slug: product.slug,
            image: product.images[0],
            quantity: quantity,
            listPrice: product.listPrice + priceAdjustment,
            salePrice: product.salePrice || undefined, // Pass salePrice
            vatRate: product.vatRate,
            stock: product.stock,
            minQuantity: product.minQuantity,
            discountRate: discountRate, // Always pass the user's/dealer's discount rate
            desi: effectiveDesi,
            variantId: selectedVariant?.id,
            variantInfo: variantInfo,
        });
        toast.success("Ürün sepete eklendi!");
    };

    // Helper to build category breadcrumbs
    const getCategoryPath = (cat: any) => {
        const path = [];
        let current = cat;
        while (current) {
            path.unshift(current);
            current = current.parent;
        }
        return path;
    };

    // Birden fazla kategori olabilir, önce alt kategoriyi (parent'ı olanı) tercih et
    const primaryCategory = (product.categories || []).find((c: any) => c.parent) 
        || (product.categories || [])[0] 
        || null;
    const categoryPath = primaryCategory ? getCategoryPath(primaryCategory) : [];

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
            <div className="container mx-auto px-4 py-6 animate-in fade-in duration-500">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6 overflow-x-auto whitespace-nowrap">
                    <Link href="/" className="hover:text-[#009AD0] transition-colors">
                        Ana Sayfa
                    </Link>
                    
                    {categoryPath.length > 0 ? (
                        categoryPath.map((cat, index) => (
                            <div key={cat.id} className="flex items-center gap-1.5">
                                <ChevronRightIcon className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                                <Link
                                    href={`/category/${cat.slug}`}
                                    className="hover:text-[#009AD0] transition-colors"
                                >
                                    {cat.name}
                                </Link>
                            </div>
                        ))
                    ) : (
                        <>
                            <ChevronRightIcon className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                            <Link href="/products" className="hover:text-[#009AD0] transition-colors">
                                Ürünler
                            </Link>
                        </>
                    )}
                    
                    <ChevronRightIcon className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                    <span className="text-gray-800 dark:text-gray-200 font-medium truncate max-w-[200px]">{product.name}</span>
                </nav>

                {/* Main Product Section */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden mb-8">
                    <div className="grid lg:grid-cols-2 gap-0">
                        {/* Left: Image Gallery */}
                        <div className="p-6 lg:p-8 border-b lg:border-b-0 lg:border-r border-gray-100 dark:border-gray-800">
                            {/* Main Image */}
                            <div className="relative aspect-[4/3] bg-white dark:bg-gray-800/50 rounded-xl overflow-hidden group mb-4 border border-gray-100 dark:border-gray-800">
                                {product.images[0] ? (
                                    <Image
                                        src={product.images[activeImageIndex] || product.images[0]}
                                        alt={product.name}
                                        fill
                                        className="object-contain p-6 group-hover:scale-105 transition-transform duration-500"
                                        priority
                                        sizes="(max-width: 1024px) 100vw, 50vw"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full">
                                        <Package className="w-20 h-20 text-gray-300" />
                                    </div>
                                )}

                                {/* Stock Badge */}
                                {product.stock === 0 && (
                                    <div className="absolute top-4 left-4 z-10">
                                        <Badge variant="destructive" className="text-sm px-3 py-1 shadow-lg">
                                            Stokta Yok
                                        </Badge>
                                    </div>
                                )}

                                {/* Discount Badge */}
                                {(hasSalePrice || (isDealer && discountRate > 0)) && (
                                    <div className="absolute top-4 right-4 z-10">
                                        <Badge className="bg-red-500 hover:bg-red-600 text-white border-none px-3 py-1 text-sm font-bold shadow-lg">
                                            %{Math.max(discountRate, saleDiscountRate)} İndirim
                                        </Badge>
                                    </div>
                                )}

                                {/* Navigation Arrows */}
                                {product.images.length > 1 && (
                                    <>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setActiveImageIndex((prev) =>
                                                    prev === 0 ? product.images.length - 1 : prev - 1
                                                );
                                            }}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-white/90 dark:bg-gray-900/90 shadow-md opacity-0 group-hover:opacity-100 transition-all hover:bg-[#009AD0] hover:text-white"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setActiveImageIndex((prev) =>
                                                    prev === product.images.length - 1 ? 0 : prev + 1
                                                );
                                            }}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-white/90 dark:bg-gray-900/90 shadow-md opacity-0 group-hover:opacity-100 transition-all hover:bg-[#009AD0] hover:text-white"
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </button>
                                    </>
                                )}
                            </div>

                            {/* Thumbnails */}
                            {product.images.length > 1 && (
                                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                                    {product.images.map((image, index) => (
                                        <button
                                            key={index}
                                            type="button"
                                            onClick={() => setActiveImageIndex(index)}
                                            className={cn(
                                                "relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all shrink-0",
                                                activeImageIndex === index
                                                    ? "border-[#009AD0] ring-1 ring-[#009AD0]/30"
                                                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 opacity-60 hover:opacity-100"
                                            )}
                                        >
                                            <Image
                                                src={image}
                                                alt={`${product.name} - ${index + 1}`}
                                                fill
                                                className="object-contain p-1"
                                            />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Right: Product Info & Buy Box */}
                        <div className="p-6 lg:p-8 flex flex-col">
                            {/* Category & Brand */}
                            <div className="flex items-center gap-2 mb-3">
                                {product.category && (
                                    <Link
                                        href={`/products?category=${product.category.slug}`}
                                        className="text-[#009AD0] text-xs font-semibold hover:underline uppercase tracking-wide"
                                    >
                                        {product.category.name}
                                    </Link>
                                )}
                                {product.brand && (
                                    <>
                                        {product.category && <span className="text-gray-300">•</span>}
                                        <span className="text-xs text-gray-500 font-medium">{product.brand.name}</span>
                                    </>
                                )}
                            </div>

                            {/* Title */}
                            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white leading-snug mb-2">
                                {product.name}
                            </h1>

                            {/* Rating Summary */}
                            <div className="flex items-center gap-2 mb-4">
                                <div className="flex gap-0.5">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                            key={star}
                                            className={cn(
                                                "w-4 h-4",
                                                reviewStats.averageRating >= star
                                                    ? "fill-yellow-400 text-yellow-400"
                                                    : "text-gray-200 dark:text-gray-700"
                                            )}
                                        />
                                    ))}
                                </div>
                                <span className="text-sm text-gray-500">
                                    ({reviewStats.totalReviews} Değerlendirme)
                                </span>
                            </div>

                            {/* Price */}
                            <div className="mb-4 pb-4 border-b border-gray-100 dark:border-gray-800">
                                <div className="flex items-end gap-3">
                                    <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#009AD0] tracking-tight">
                                        {formatPrice(displayFinalPrice)}
                                    </span>
                                    {showStrikethrough && (
                                        <span className="text-lg text-gray-400 line-through font-medium mb-1">
                                            {formatPrice(strikethroughPrice)}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-400 mt-1">KDV Dahil</p>
                            </div>

                            {/* Product Info Grid */}
                            <div className="mb-5 pb-5 border-b border-gray-100 dark:border-gray-800">
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs mb-3">
                                    {product.sku && (
                                        <div>
                                            <span className="text-gray-400 block mb-0.5">Stok Kodu</span>
                                            <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">{product.sku}</span>
                                        </div>
                                    )}
                                    {product.barcode && (
                                        <div>
                                            <span className="text-gray-400 block mb-0.5">Barkod</span>
                                            <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">{product.barcode}</span>
                                        </div>
                                    )}
                                    {product.origin && (
                                        <div>
                                            <span className="text-gray-400 block mb-0.5">Menşei</span>
                                            <span className="font-semibold text-gray-700 dark:text-gray-300">{product.origin}</span>
                                        </div>
                                    )}
                                    {product.brand && (
                                        <div>
                                            <span className="text-gray-400 block mb-0.5">Marka</span>
                                            <span className="font-semibold text-gray-700 dark:text-gray-300">{product.brand.name}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="text-xs text-emerald-600 dark:text-emerald-400 italic flex items-center gap-1.5 p-2 bg-emerald-50 dark:bg-emerald-950/20 rounded-md border border-emerald-100 dark:border-emerald-900/20 animate-in fade-in duration-300">
                                    <Truck className="w-4 h-4 shrink-0" />
                                    <span>Tebrikler! Bu üründe <strong>kargo ücreti</strong> tarafımızca karşılanmaktadır (Ücretsiz Kargo).</span>
                                </div>
                            </div>

                            {/* Variants */}
                            {hasVariants && (
                                <div className="space-y-4 mb-5 pb-5 border-b border-gray-100 dark:border-gray-800">
                                    {colors.length > 0 && (
                                        <div>
                                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                                                Renk: <span className="text-[#009AD0]">{selectedColor}</span>
                                            </span>
                                            <div className="flex flex-wrap gap-2">
                                                {colors.map((color) => (
                                                    <button
                                                        key={color}
                                                        onClick={() => setSelectedColor(color)}
                                                        className={cn(
                                                            "w-9 h-9 rounded-full border-2 transition-all p-0.5",
                                                            selectedColor === color
                                                                ? "border-[#009AD0] ring-2 ring-[#009AD0]/20 scale-110"
                                                                : "border-transparent hover:border-gray-300"
                                                        )}
                                                    >
                                                        <div className="w-full h-full rounded-full bg-gray-200 border border-black/5 overflow-hidden relative">
                                                            {product.images[0] && (
                                                                <Image src={product.images[0]} alt={color} fill className="object-cover" />
                                                            )}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {sizes.length > 0 && (
                                        <div>
                                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                                                Beden: <span className="text-[#009AD0]">{selectedSize}</span>
                                            </span>
                                            <div className="flex flex-wrap gap-2">
                                                {sizes.map((size) => (
                                                    <button
                                                        key={size}
                                                        onClick={() => setSelectedSize(size)}
                                                        className={cn(
                                                            "h-9 px-4 rounded-lg border-2 text-sm font-bold transition-all",
                                                            selectedSize === size
                                                                ? "border-[#009AD0] bg-[#009AD0]/5 text-[#009AD0]"
                                                                : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                                                        )}
                                                    >
                                                        {size}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Add to Cart Section */}
                            <div className="mt-auto space-y-3">
                                {product.stock > 0 ? (
                                    <>
                                        {/* Dynamic Shipping Banner */}
                                        <ShippingInfoBanner />

                                        {/* Stock indicator */}
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            <span className="text-xs font-medium text-green-600 dark:text-green-400">Stokta Mevcut</span>
                                        </div>

                                        <div className="grid grid-cols-12 gap-3 sm:flex sm:flex-wrap sm:items-center">
                                            {/* Quantity selector */}
                                            <div className="col-span-4 sm:w-auto flex items-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shrink-0">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-10 w-8 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                                                    onClick={() => adjustQuantity(-1)}
                                                    disabled={quantity <= product.minQuantity}
                                                >
                                                    <Minus className="h-3.5 w-3.5" />
                                                </Button>
                                                <Input
                                                    type="number"
                                                    value={inputValue}
                                                    onChange={handleInputChange}
                                                    onBlur={handleInputBlur}
                                                    onFocus={handleFocus}
                                                    className="w-full min-w-0 text-center border-none bg-transparent h-10 text-sm font-bold focus-visible:ring-0 p-0"
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-10 w-8 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                                                    onClick={() => adjustQuantity(1)}
                                                    disabled={quantity >= effectiveStock}
                                                >
                                                    <Plus className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>

                                            {/* Add to Cart Button */}
                                            <Button
                                                className="col-span-8 sm:flex-1 h-12 text-base font-bold bg-[#009AD0] hover:bg-[#007baa] text-white rounded-lg transition-all active:scale-[0.98] shadow-lg shadow-[#009AD0]/20"
                                                onClick={handleAddToCart}
                                            >
                                                <ShoppingCart className="h-5 w-5 mr-2" />
                                                Sepete Ekle
                                            </Button>

                                            {/* WhatsApp */}
                                            {whatsappNumber && (
                                                <div className="col-span-10 sm:w-full sm:mt-0 sm:basis-full sm:order-last">
                                            {(() => {
                                                let cleanPhone = (whatsappNumber || "").replace(/[^0-9]/g, "");
                                                if (cleanPhone.startsWith('0')) cleanPhone = '90' + cleanPhone.substring(1);
                                                else if (!cleanPhone.startsWith('90') && cleanPhone.length === 10) cleanPhone = '90' + cleanPhone;

                                                return (
                                                    <Button
                                                        variant="outline"
                                                        className="w-full h-11 font-semibold border-green-200 text-green-700 hover:bg-green-50 hover:border-green-400 rounded-lg transition-all"
                                                        asChild
                                                    >
                                                        <a
                                                            href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                                                                `Merhaba, ${product.name} ürününü sipariş etmek istiyorum.${product.sku ? ` Stok Kodu: ${product.sku}` : ''}`
                                                            )}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                                            </svg>
                                                            WhatsApp ile Sor
                                                        </a>
                                                    </Button>
                                                );
                                            })()}
                                                </div>
                                            )}

                                            <WishlistButton
                                                productId={product.id}
                                                variant="icon"
                                                className="col-span-2 sm:col-auto h-11 w-full sm:h-12 sm:w-12 border border-gray-200 dark:border-gray-700 rounded-lg shrink-0"
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <div className="bg-red-50 dark:bg-red-900/20 text-red-600 p-4 rounded-lg text-center text-sm font-bold border border-red-100 dark:border-red-900/30">
                                        Bu ürün şu an stoklarımızda bulunmamaktadır.
                                    </div>
                                )}
                            </div>

                            {/* Trust Badges */}
                            <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-gray-100 dark:border-gray-800">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-[#009AD0]/10 flex items-center justify-center shrink-0">
                                        <Truck className="w-4 h-4 text-[#009AD0]" />
                                    </div>
                                    <span className="text-[11px] text-gray-600 dark:text-gray-400 font-medium leading-tight">Hızlı Kargo</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-[#009AD0]/10 flex items-center justify-center shrink-0">
                                        <Shield className="w-4 h-4 text-[#009AD0]" />
                                    </div>
                                    <span className="text-[11px] text-gray-600 dark:text-gray-400 font-medium leading-tight">Güvenli Ödeme</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-[#009AD0]/10 flex items-center justify-center shrink-0">
                                        <Package className="w-4 h-4 text-[#009AD0]" />
                                    </div>
                                    <span className="text-[11px] text-gray-600 dark:text-gray-400 font-medium leading-tight">Orjinal Ürün</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs Section */}
                <div className="mb-12">
                    <Tabs defaultValue="description" className="w-full">
                        <TabsList className="w-full bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-1.5 flex flex-wrap gap-1 shadow-sm mb-4 h-auto">
                            <TabsTrigger
                                value="description"
                                className="flex-1 text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2.5 rounded-lg data-[state=active]:bg-[#009AD0] data-[state=active]:text-white data-[state=active]:shadow-sm transition-all whitespace-nowrap"
                            >
                                <FileText className="w-4 h-4 mr-1.5 hidden sm:inline-block" />
                                Ürün Açıklaması
                            </TabsTrigger>
                            <TabsTrigger
                                value="payment"
                                className="flex-1 text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2.5 rounded-lg data-[state=active]:bg-[#009AD0] data-[state=active]:text-white data-[state=active]:shadow-sm transition-all whitespace-nowrap"
                            >
                                <CreditCard className="w-4 h-4 mr-1.5 hidden sm:inline-block" />
                                Ödeme Seçenekleri
                            </TabsTrigger>
                            <TabsTrigger
                                value="reviews"
                                className="flex-1 text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2.5 rounded-lg data-[state=active]:bg-[#009AD0] data-[state=active]:text-white data-[state=active]:shadow-sm transition-all whitespace-nowrap"
                            >
                                <Star className="w-4 h-4 mr-1.5 hidden sm:inline-block" />
                                Değerlendirmeler ({reviewStats.totalReviews})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="description" className="focus-visible:ring-0 mt-0">
                            <div className="bg-white dark:bg-gray-900 rounded-xl p-4 sm:p-6 lg:p-8 border border-gray-100 dark:border-gray-800 shadow-sm">
                                {product.description ? (
                                    <div
                                        className="prose prose-sm sm:prose-base dark:prose-invert max-w-none prose-headings:text-gray-900 dark:prose-headings:text-white prose-a:text-[#009AD0] prose-img:rounded-xl prose-p:text-gray-600 dark:prose-p:text-gray-400 prose-li:text-gray-600 dark:prose-li:text-gray-400 prose-strong:text-gray-800 dark:prose-strong:text-gray-200 product-description-content"
                                        dangerouslySetInnerHTML={{ __html: product.description }}
                                    />
                                ) : (
                                    <div className="text-gray-400 italic py-12 text-center text-sm">
                                        Bu ürün için henüz bir açıklama girilmemiş.
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="payment" className="focus-visible:ring-0 mt-0">
                            <div className="bg-white dark:bg-gray-900 rounded-xl p-4 sm:p-6 lg:p-8 border border-gray-100 dark:border-gray-800 shadow-sm">
                                <div className="mb-6 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/20 flex items-start gap-3">
                                    <CreditCard className="w-5 h-5 text-[#009AD0] shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-bold text-blue-900 dark:text-blue-300">Güvenli Ödeme Sistemi</p>
                                        <p className="text-xs text-blue-800/70 dark:text-blue-400 mt-0.5">Tüm kredi kartlarına taksit imkanı. PayTR güvencesiyle 256-bit SSL şifreleme.</p>
                                    </div>
                                </div>
                                <div className="overflow-x-auto -mx-4 sm:mx-0">
                                    <div className="min-w-[500px] sm:min-w-0 px-4 sm:px-0">
                                        <InstallmentTable price={displayFinalPrice} />
                                    </div>
                                </div>
                                <p className="mt-6 text-[11px] text-gray-400 italic text-center">
                                    * Taksit oranları ve banka kampanyaları anlık olarak güncellenmektedir.
                                </p>
                            </div>
                        </TabsContent>

                        <TabsContent value="reviews" className="focus-visible:ring-0 mt-0">
                            <div className="grid md:grid-cols-12 gap-8">
                                <div className="md:col-span-4 lg:col-span-3">
                                    <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-100 dark:border-gray-800 sticky top-4">
                                        <div className="text-center mb-6">
                                            <div className="text-5xl font-bold text-gray-900 dark:text-white mb-2">
                                                {reviewStats.averageRating.toFixed(1)}
                                            </div>
                                            <div className="flex justify-center gap-1 mb-2">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <Star
                                                        key={star}
                                                        className={cn(
                                                            "w-5 h-5",
                                                            Math.round(reviewStats.averageRating) >= star
                                                                ? "fill-yellow-400 text-yellow-400"
                                                                : "text-gray-200 dark:text-gray-700"
                                                        )}
                                                    />
                                                ))}
                                            </div>
                                            <p className="text-sm text-gray-500">
                                                {reviewStats.totalReviews} Değerlendirme
                                            </p>
                                        </div>

                                        {isAuthenticated ? (
                                            <ReviewForm productId={product.id} />
                                        ) : (
                                            <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg">
                                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                                    Değerlendirme yapabilmek için giriş yapmalısınız.
                                                </p>
                                                <Link href="/login">
                                                    <Button variant="outline" size="sm" className="w-full">
                                                        Giriş Yap
                                                    </Button>
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="md:col-span-8 lg:col-span-9">
                                    <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-100 dark:border-gray-800">
                                        <h3 className="text-lg font-bold mb-6">Müşteri Değerlendirmeleri</h3>
                                        <ReviewList reviews={reviews} />
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Related Products */}
                {relatedProducts.length > 0 && (
                    <div className="border-t border-gray-200 dark:border-gray-800 pt-12 pb-8">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                Benzer Ürünler
                            </h2>
                            <Link href={`/products?category=${product.category?.slug}`} className="text-[#009AD0] hover:underline font-semibold text-sm">
                                Tümünü Gör →
                            </Link>
                        </div>

                        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                            {relatedProducts.map((p) => (
                                <ProductCardV2
                                    key={p.id}
                                    product={p}
                                    discountRate={discountRate}
                                    isDealer={isDealer}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
