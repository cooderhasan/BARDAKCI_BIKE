import Link from "next/link";
import { ProductCardModern } from "./product-card-modern";
import { ArrowRight } from "lucide-react";

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
    isFreeShipping?: boolean;
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
    variant = "default",
}: FeaturedProductsProps) {
    if (products.length === 0) return null;

    // Başlığın üstündeki küçük etiket
    const eyebrow = {
        new: "Yeni Gelenler",
        featured: "Sizin İçin Seçtik",
        bestseller: "En Çok Tercih Edilenler",
        default: "",
    }[variant];
    // "Öne Çıkanlar" hafif lacivert zeminli bir bant içinde: bölümler alt alta aynı görünmesin (arka plan ritmi)
    const banded = variant === "featured";

    return (
        // Sayfa zaten container + px-4 içinde; burada tekrar container/px-4 vardı, telefonda kenar boşluğu ikiye katlanıyordu
        <section className={banded ? "rounded-3xl bg-[#17457C]/[0.05] dark:bg-blue-950/20 ring-1 ring-[#17457C]/5 px-3 py-6 sm:px-6 md:px-8 md:py-10" : ""}>
            {/* Section Header */}
            <div className="flex items-end justify-between gap-4 mb-5 md:mb-7">
                <div className="min-w-0">
                    {eyebrow && (
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="h-px w-6 bg-[#17457C] dark:bg-blue-400" />
                            <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.18em] text-[#17457C] dark:text-blue-400">
                                {eyebrow}
                            </span>
                        </div>
                    )}
                    <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                        {title}
                    </h2>
                </div>
                <Link
                    href={variant === "new" ? "/products?sort=newest" : "/products"}
                    className="group/all shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[#17457C]/20 bg-white dark:bg-gray-900 dark:border-gray-700 px-3.5 py-2 text-xs md:text-sm font-semibold text-[#17457C] dark:text-blue-300 hover:bg-[#17457C] hover:text-white hover:border-[#17457C] transition-colors"
                >
                    Tümünü Gör
                    <ArrowRight className="h-3.5 w-3.5 md:h-4 md:w-4 transition-transform group-hover/all:translate-x-0.5" />
                </Link>
            </div>

            {/* Products Grid */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
