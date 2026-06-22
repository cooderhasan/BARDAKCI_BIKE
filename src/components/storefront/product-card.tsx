"use client";

import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatPrice, calculatePrice } from "@/lib/helpers";
import { ShoppingCart, Eye } from "lucide-react";
import { useCartStore } from "@/stores/cart-store";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WishlistButton } from "@/components/products/wishlist-button";

interface Product {
    id: string;
    name: string;
    slug: string;
    images: string[];
    listPrice: number;
    salePrice?: number | null; // Add salePrice
    vatRate: number;
    minQuantity: number;
    stock: number;
    weight?: number | null;
    width?: number | null;
    height?: number | null;
    length?: number | null;
    desi?: number | null;
    category: {
        name: string;
        slug: string;
    } | null;
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

export function ProductCard({
    product,
    discountRate,
    isDealer,
    badge,
}: ProductCardProps) {
    const { addItem } = useCartStore();
    const price = calculatePrice(
        product.listPrice,
        product.salePrice, // Pass salePrice
        discountRate,
        product.vatRate
    );

    const hasVariants = product._count?.variants && product._count.variants > 0;

    // Calculate exact discount percentage for cart if not passed
    const exactSaleDiscountRate = product.salePrice
        ? ((product.listPrice - product.salePrice) / product.listPrice) * 100
        : 0;

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
            quantity: product.minQuantity || 1,
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

    return (
        <Link href={`/products/${product.slug}`} className="group block h-full">
            <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 h-full flex flex-col relative">
                {/* Image */}
                <div className="relative aspect-square bg-white dark:bg-gray-700 overflow-hidden">
                    {product.images[0] ? (
                        <Image
                            src={product.images[0]}
                            alt={product.name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                            <span className="text-4xl">📦</span>
                        </div>
                    )}

                    {/* Badges */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1.5 z-10 items-start">
                        {badge && (
                            <Badge className="bg-[#009AD0]">{badge}</Badge>
                        )}
                        {product.stock === 0 && (
                            <Badge variant="destructive">Stokta Yok</Badge>
                        )}
                        {/* Discount Badge moved here */}
                        {discountRate > 0 && (
                            <Badge className="bg-green-600">
                                %{discountRate} İndirim
                            </Badge>
                        )}
                        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white animate-in fade-in duration-300">
                            Ücretsiz Kargo
                        </Badge>
                    </div>

                    {/* Wishlist Button */}
                    <div className="absolute top-2 right-2 z-10">
                        <WishlistButton productId={product.id} variant="icon" className="bg-white/80 backdrop-blur-sm hover:bg-white shadow-sm" />
                    </div>
                </div>


                {/* Content */}
                <div className="p-4 flex-1 flex flex-col">
                    {product.category && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                            {product.category.name}
                        </p>
                    )}
                    <h3 className="font-medium text-gray-900 dark:text-white line-clamp-2 mb-2 group-hover:text-[#009AD0] transition-colors flex-1">
                        {product.name}
                    </h3>

                    {/* Pricing */}
                    <div className="space-y-1 mt-auto pt-2">
                        {discountRate > 0 && (
                            <p className="text-sm text-gray-400 line-through">
                                {formatPrice(price.listPrice)}
                            </p>
                        )}
                        <p className="text-lg font-bold text-[#009AD0] dark:text-[#009AD0]">
                            {formatPrice(price.finalPrice)}
                        </p>
                    </div>

                    {/* Min Quantity Info */}
                    {product.minQuantity > 1 && (
                        <p className="text-xs text-amber-600 mt-2">
                            Min. sipariş: {product.minQuantity} adet
                        </p>
                    )}

                    {/* Add to Cart / View Button - Visible on Hover */}
                    <div className="opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 ease-out">
                        {product.stock > 0 ? (
                            hasVariants ? (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full mt-3 border-[#009AD0] text-[#009AD0] hover:bg-[#009AD0]/10"
                                >
                                    <Eye className="w-4 h-4 mr-2" />
                                    Seçenekleri Gör
                                </Button>
                            ) : (
                                <button
                                    onClick={handleAddToCart}
                                    className="w-full mt-3 py-2.5 px-4 bg-[#009AD0] hover:bg-[#009AD0]/90 text-white text-sm font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                                >
                                    <ShoppingCart className="w-4 h-4" />
                                    Sepete Ekle
                                </button>
                            )
                        ) : (
                            <Button
                                size="sm"
                                variant="secondary"
                                className="w-full mt-3"
                                disabled
                            >
                                Stokta Yok
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </Link>
    );
}
