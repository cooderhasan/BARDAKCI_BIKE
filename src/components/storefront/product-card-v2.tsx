"use client";

import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatPrice, calculatePrice } from "@/lib/helpers";
import { ShoppingCart, Heart, RefreshCw, Minus, Plus, Star, Eye } from "lucide-react";
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
    _count?: {
        variants: number;
    };
}

interface ProductCardProps {
    product: Product;
    discountRate: number;
    isDealer: boolean;
    badge?: string;
}

export function ProductCardV2({
    product,
    discountRate,
    isDealer,
    badge,
}: ProductCardProps) {
    const { addItem } = useCartStore();
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

    // Calculate rounded discount percentage for badge
    const saleDiscountRate = Math.round(exactSaleDiscountRate);

    // Determine which price to display
    const displayPrice = hasSalePrice && product.salePrice != null ? product.salePrice : (isDealer ? price.finalPrice : product.listPrice);
    const showStrikethrough = hasSalePrice || (isDealer && discountRate > 0);
    const strikethroughPrice = product.listPrice;

    // Badge rate: sale discount takes precedence, otherwise dealer discount (if dealer)
    const discountBadgeRate = hasSalePrice ? saleDiscountRate : 0;

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

        addItem({
            productId: product.id,
            name: product.name,
            slug: product.slug,
            image: product.images[0],
            quantity: quantity,
            listPrice: product.listPrice,
            salePrice: product.salePrice || undefined, // Pass salePrice
            vatRate: product.vatRate,
            stock: product.stock,
            minQuantity: product.minQuantity,
            discountRate: discountRate, // Always pass the user's/dealer's discount rate
            desi: effectiveDesi,
        });

        toast.success("Ürün sepete eklendi");
    };

    const handleQuantityChange = (e: React.MouseEvent, delta: number) => {
        e.preventDefault();
        e.stopPropagation();
        const newQty = Math.max(product.minQuantity || 1, quantity + delta);
        if (newQty <= product.stock) {
            setQuantity(newQty);
        } else {
            toast.error("Stok miktarını aştınız");
        }
    };

    return (
        <Link href={`/products/${product.slug}`} className="group block h-full">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full flex flex-col relative group/card">

                {/* Image Section - Cleaner Aspect Ratio */}
                <div className="relative aspect-square bg-white p-4 flex items-center justify-center">
                    {/* Badges Stack Left */}
                    <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 items-start">
                        {(isDealer && discountRate > 0 || hasSalePrice) && (
                            <div className="bg-[#E31E24] text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm animate-in fade-in duration-300">
                                %{Math.max(discountRate, saleDiscountRate)} İNDİRİM
                            </div>
                        )}
                        <div className="bg-emerald-600 text-white text-[9px] md:text-[10px] font-bold px-2 py-1 rounded-full shadow-sm whitespace-nowrap animate-in fade-in duration-300">
                            ÜCRETSİZ KARGO
                        </div>
                    </div>
                    {/* Badge */}
                    {badge && (
                        <div className="absolute top-3 right-3 z-10 bg-[#009AD0] text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">
                            {badge}
                        </div>
                    )}
                    {/* Stock Badge */}
                    {product.stock === 0 && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-gray-900/80 text-white text-xs font-bold px-3 py-1.5 rounded-lg backdrop-blur-sm">
                            Tükendi
                        </div>
                    )}

                    {product.images[0] ? (
                        <Image
                            src={product.images[0]}
                            alt={product.name}
                            fill
                            className={cn(
                                "object-contain p-3 transition-transform duration-500 group-hover:scale-110",
                                product.stock === 0 && "opacity-50 grayscale"
                            )}
                            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                        />
                    ) : (
                        <div className="text-gray-300">
                            <span className="text-5xl">📦</span>
                        </div>
                    )}
                </div>

                {/* Content Section */}
                <div className="p-4 flex-1 flex flex-col bg-white dark:bg-gray-800/50">
                    {/* Brand */}
                    {product.brand && (
                        <p className="text-[#009AD0] font-bold text-xs uppercase tracking-wider mb-1">
                            {product.brand.name}
                        </p>
                    )}

                    {/* Product Name */}
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm leading-snug line-clamp-2 h-10 mb-3 group-hover:text-[#009AD0] transition-colors">
                        {product.name}
                    </h3>

                    {/* Price Section */}
                    <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700">
                        <div className="flex flex-col">
                            {showStrikethrough && (
                                <span className="text-xs text-gray-400 line-through mb-0.5">
                                    {formatPrice(strikethroughPrice)}
                                </span>
                            )}
                            <div className="flex items-baseline gap-1">
                                <span className="text-lg font-bold text-gray-900 dark:text-white">
                                    {formatPrice(displayPrice)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Action Section - Always Visible */}
                    <div className="mt-4">
                        {product.stock > 0 && !hasVariants ? (
                            <Button
                                onClick={handleAddToCart}
                                className="w-full h-10 bg-[#009AD0] hover:bg-[#007EA8] text-white font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2"
                            >
                                <ShoppingCart className="w-4 h-4" />
                                <span>Sepete Ekle</span>
                            </Button>
                        ) : (
                            <div className="h-10 flex items-center justify-center">
                                <span className="text-xs text-gray-500 font-medium w-full text-center py-2.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
                                    {hasVariants ? "Seçenekleri Gör" : "Stokta Yok"}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Link>
    );
}
