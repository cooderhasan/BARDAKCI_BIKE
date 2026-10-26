"use client";

import Image from "next/image";
import Link from "next/link";
import { formatPrice, calculatePrice } from "@/lib/helpers";
import { ShoppingCart, ShoppingBag, Eye, Truck } from "lucide-react";
import { useCartStore } from "@/stores/cart-store";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

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
    category: {
        name: string;
        slug: string;
    } | null;
    brand?: {
        name: string;
        slug: string;
    } | null;
    weight?: number | null;
    width?: number | null;
    height?: number | null;
    length?: number | null;
    desi?: number | null;
    isFreeShipping?: boolean;
    googlePrice?: number | null;
    _count?: {
        variants: number;
    };
}

interface ProductCardProps {
    product: Product;
    discountRate: number;
    isDealer: boolean;
    badge?: string;
    priority?: boolean;
}

export function ProductCardModern({
    product,
    discountRate,
    isDealer,
    badge,
    priority = false,
}: ProductCardProps) {
    const { addItem, openAddedToCartModal } = useCartStore();
    const [quantity, setQuantity] = useState(product.minQuantity || 1);

    const price = calculatePrice(
        product.listPrice,
        product.salePrice, // Pass salePrice
        discountRate,
        product.vatRate
    );

    // Sale Price Logic
    const hasSalePrice = product.salePrice != null && product.salePrice < product.listPrice;

    // Calculate exact discount percentage for cart
    const exactSaleDiscountRate = hasSalePrice && product.salePrice != null
        ? ((product.listPrice - product.salePrice) / product.listPrice) * 100
        : 0;

    // Use rounded for badge
    const saleDiscountRate = Math.round(exactSaleDiscountRate);

    // Determine which price to display
    const displayPrice = hasSalePrice && product.salePrice != null ? product.salePrice : (isDealer ? price.finalPrice : product.listPrice);
    const showStrikethrough = hasSalePrice || (isDealer && discountRate > 0);
    const strikethroughPrice = product.listPrice;

    // Badge rate: sale discount takes precedence, otherwise dealer discount (if dealer)
    // const discountBadgeRate = hasSalePrice ? saleDiscountRate : 0; // Unused variable?

    const hasVariants = product._count?.variants && product._count.variants > 0;

    const handleAddToCart = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (hasVariants) {
            return;
        }

        // Calculate effective desi
        const dimsDesi = (Number(product.width || 0) * Number(product.height || 0) * Number(product.length || 0)) / 3000;
        const effectiveDesi = Math.max(Number(product.weight || 0), Number(product.desi || 0), dimsDesi);

        const itemToAdd = {
            productId: product.id,
            name: product.name,
            slug: product.slug,
            image: product.images[0],
            quantity: quantity,
            listPrice: product.listPrice,
            salePrice: product.salePrice || undefined,
            vatRate: product.vatRate,
            stock: product.stock,
            minQuantity: product.minQuantity,
            discountRate: discountRate,
            desi: effectiveDesi,
            isFreeShipping: product.isFreeShipping,
        };

        addItem(itemToAdd);
        openAddedToCartModal(itemToAdd);
    };

    return (
        <Link href={`/products/${product.slug}`} className="group block h-full">
            <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden transition-all duration-300 ring-1 ring-gray-200/60 dark:ring-gray-700 hover:ring-gray-200 hover:shadow-[0_12px_32px_-8px_rgba(23,69,124,0.18)] md:hover:-translate-y-1 h-full flex flex-col relative group/card">

                {/* Görsel alanı: açık gri zemin. Ürün fotoğrafları çoğunlukla beyaz zeminli; mix-blend-multiply ile beyaz,
                    zemin rengine karışır ve ürün "kutu içinde beyaz dikdörtgen" gibi değil, zeminde duruyormuş gibi görünür */}
                <div className="relative aspect-square m-2 md:m-2.5 rounded-xl bg-[#f3f5f8] dark:bg-gray-900 flex items-center justify-center overflow-hidden">
                    {/* Sol üst: Sadece İndirim etiketi */}
                    {(isDealer && discountRate > 0 || hasSalePrice) && (
                        <div className="absolute top-2.5 left-2.5 z-10">
                            <div className="bg-red-500 text-white text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md whitespace-nowrap">
                                %{Math.max(discountRate, saleDiscountRate)} İNDİRİM
                            </div>
                        </div>
                    )}

                    {/* Sağ üst: Sadece Yeni / özel badge */}
                    {badge && (
                        <div className="absolute top-2.5 right-2.5 z-10">
                            <div className="bg-blue-500 text-white text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md whitespace-nowrap">
                                {badge}
                            </div>
                        </div>
                    )}

                    {/* Stock Badge */}
                    {product.stock === 0 && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-20 flex items-center justify-center">
                            <div className="bg-gray-900 text-white text-xs font-bold px-4 py-2 rounded-full shadow-xl">
                                STOK TÜKENDİ
                            </div>
                        </div>
                    )}

                    {product.images[0] ? (
                        <Image
                            src={product.images[0]}
                            alt={product.name}
                            fill
                            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            priority={priority}
                            loading={priority ? "eager" : "lazy"}
                            className={cn(
                                "object-contain p-3 md:p-4 mix-blend-multiply dark:mix-blend-normal transition-transform duration-500 ease-out group-hover/card:scale-105",
                                product.stock === 0 && "opacity-50 grayscale"
                            )}
                        />
                    ) : (
                        <div className="text-gray-300">
                            <span className="text-5xl">📦</span>
                        </div>
                    )}

                    {/* Hover Action Overlay (Optional - Keep clean for now or add Quick View) */}
                </div>

                {/* Content Section */}
                <div className="px-3 pb-3 pt-1 md:px-4 md:pb-4 flex-1 flex flex-col">
                    {/* Marka + Ücretsiz Kargo: tek satır, sade yazı (önceden her kartta yeşil çerçeveli büyük rozet vardı) */}
                    <div className="flex items-center justify-between gap-2 mb-1 md:mb-1.5 min-w-0">
                        {product.brand ? (
                            <span className="truncate text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500" title={product.brand.name}>
                                {product.brand.name}
                            </span>
                        ) : <span />}
                        {product.isFreeShipping && (
                            <span className="inline-flex items-center gap-1 shrink-0 text-[10px] md:text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap" title="Ücretsiz Kargo">
                                <Truck className="w-3.5 h-3.5 shrink-0" />
                                <span className="hidden sm:inline">Ücretsiz Kargo</span>
                                <span className="sm:hidden">Ücretsiz</span>
                            </span>
                        )}
                    </div>

                    {/* Product Name */}
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-[13px] md:text-sm leading-snug line-clamp-2 min-h-[2.5rem] mb-2 md:mb-3 group-hover:text-[#17457C] transition-colors">
                        {product.name}
                    </h3>

                    {/* Fiyat + tam genişlik "Sepete Ekle" (yazı telefonda da görünür; önceden telefonda sadece simge vardı) */}
                    <div className="mt-auto space-y-2.5">
                        <div className="flex flex-col min-w-0">
                            {showStrikethrough && (
                                <span className="text-[10px] md:text-xs text-gray-400 line-through font-medium truncate leading-none mb-0.5">
                                    {formatPrice(strikethroughPrice)}
                                </span>
                            )}
                            <span className="text-lg md:text-xl font-extrabold text-gray-900 dark:text-white tracking-tight truncate">
                                {formatPrice(displayPrice)}
                            </span>
                        </div>

                        {product.stock > 0 && !hasVariants ? (
                            <button
                                type="button"
                                onClick={handleAddToCart}
                                className="w-full h-10 md:h-11 flex items-center justify-center gap-2 md:gap-2.5 rounded-xl bg-gradient-to-b from-[#1d5594] to-[#17457C] text-white text-[13px] md:text-[15px] font-bold tracking-wide shadow-md shadow-[#17457C]/25 ring-1 ring-inset ring-white/10 hover:from-[#17457C] hover:to-[#0f3460] hover:shadow-lg hover:shadow-[#17457C]/35 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 whitespace-nowrap"
                            >
                                <ShoppingBag className="w-4 h-4 md:w-5 md:h-5" strokeWidth={2} />
                                Sepete Ekle
                            </button>
                        ) : hasVariants && product.stock > 0 ? (
                            // Kartın kendisi ürün sayfasına gider; seçim orada yapılır
                            <span className="w-full h-10 md:h-11 flex items-center justify-center gap-2 rounded-xl border border-[#17457C]/30 dark:border-blue-400/40 text-[#17457C] dark:text-blue-300 text-[13px] md:text-[15px] font-bold group-hover/card:bg-[#17457C] group-hover/card:text-white group-hover/card:border-[#17457C] transition-all duration-200 whitespace-nowrap">
                                Seçenekleri Gör
                            </span>
                        ) : (
                            <span className="w-full h-10 md:h-11 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 text-[13px] md:text-[15px] font-bold whitespace-nowrap">
                                Tükendi
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </Link>
    );
}
