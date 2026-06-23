"use client";

import Image from "next/image";
import Link from "next/link";
import { formatPrice, calculatePrice } from "@/lib/helpers";
import { ShoppingCart, Eye } from "lucide-react";
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
        };

        addItem(itemToAdd);
        openAddedToCartModal(itemToAdd);
    };

    return (
        <Link href={`/products/${product.slug}`} className="group block h-full">
            <div className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden transition-all duration-500 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] h-full flex flex-col relative group/card border border-transparent hover:border-gray-100 dark:hover:border-gray-700">

                {/* Image Section - Cleaner, Larger */}
                <div className="relative aspect-square bg-white p-4 flex items-center justify-center overflow-hidden">
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
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            priority={priority}
                            loading={priority ? "eager" : "lazy"}
                            className={cn(
                                "object-contain p-2 transition-all duration-700 ease-in-out group-hover/card:scale-110",
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
                <div className="p-3 md:p-5 flex-1 flex flex-col bg-white dark:bg-gray-800/50">
                    {/* Brand + Ücretsiz Kargo satırı */}
                    <div className="flex items-center justify-between gap-1 mb-1 md:mb-1.5">
                        {product.brand ? (
                            <p className="text-[#17457C] dark:text-[#17457C] font-bold text-[10px] uppercase tracking-widest opacity-80 truncate">
                                {product.brand.name}
                            </p>
                        ) : (
                            <span />
                        )}
                        <span className="shrink-0 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[8px] md:text-[9px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap">
                            🚚 ÜCRETSİZ
                        </span>
                    </div>

                    {/* Product Name */}
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm leading-relaxed line-clamp-2 h-10 mb-2 md:mb-4 group-hover:text-[#17457C] transition-colors">
                        {product.name}
                    </h3>

                    {/* Price Section */}
                    <div className="mt-auto pt-3 md:pt-4 border-t border-dashed border-gray-200 dark:border-gray-700">
                        <div className="flex flex-wrap items-center justify-between gap-y-3 gap-x-1.5 min-w-0">
                            <div className="flex flex-col min-w-0 pr-1">
                                {showStrikethrough && (
                                    <span className="text-[10px] md:text-xs text-gray-400 line-through font-medium truncate">
                                        {formatPrice(strikethroughPrice)}
                                    </span>
                                )}
                                <span className="text-base md:text-lg font-black text-gray-900 dark:text-white tracking-tight truncate">
                                    {formatPrice(displayPrice)}
                                </span>
                            </div>

                            {/* Modern Add Button */}
                            <div className="relative shrink-0 ml-auto">
                                {product.stock > 0 && !hasVariants ? (
                                    <button
                                        onClick={handleAddToCart}
                                        className="h-9 w-9 md:w-auto md:px-3.5 flex items-center justify-center rounded-full bg-[#17457C] text-white text-[11px] font-bold shadow-lg shadow-[#17457C]/20 hover:bg-[#0f3460] hover:scale-105 hover:shadow-[#17457C]/40 transition-all duration-300 active:scale-95 gap-1.5 whitespace-nowrap"
                                        title="Sepete Ekle"
                                    >
                                        <span className="hidden md:inline">Sepete Ekle</span>
                                        <ShoppingCart className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <Link href={`/products/${product.slug}`}>
                                        <button className="h-9 px-3.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white text-xs font-bold hover:bg-gray-200 transition-colors">
                                            {hasVariants ? "SEÇENEKLER" : "TÜKENDİ"}
                                        </button>
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    );
}
