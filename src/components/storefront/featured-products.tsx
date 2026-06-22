import Link from "next/link";
import { ProductCardModern } from "./product-card-modern";
import { ArrowRight, ChevronRight } from "lucide-react";

interface Product {
    id: string;
    name: string;
    slug: string;
    images: string[];
    listPrice: number;
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
}

interface FeaturedProductsProps {
    title: string;
    products: Product[];
    discountRate: number;
    isDealer: boolean;
    badge?: string;
    variant?: "featured" | "new" | "bestseller" | "default";
}

export function FeaturedProducts({
    title,
    products,
    discountRate,
    isDealer,
    badge,
}: FeaturedProductsProps) {
    if (products.length === 0) return null;

    return (
        <section className="container mx-auto px-4">
            {/* Section Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white pl-3 border-l-4 border-[#17457C]">
                    {title}
                </h2>
                <Link
                    href="/products"
                    className="flex items-center gap-1 text-sm font-medium text-[#17457C] hover:text-[#0f3460] transition-colors"
                >
                    Tümünü Gör
                    <ChevronRight className="h-4 w-4" />
                </Link>
            </div>

            {/* Products Grid */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 2xl:grid-cols-4">
                {products.map((product) => (
                    <ProductCardModern
                        key={product.id}
                        product={{
                            ...product,
                            listPrice: product.listPrice,
                        }}
                        discountRate={discountRate}
                        isDealer={isDealer}
                        badge={badge}
                    />
                ))}
            </div>
        </section>
    );
}
