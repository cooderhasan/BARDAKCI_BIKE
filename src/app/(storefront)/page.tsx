import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { HeroSlider } from "@/components/storefront/hero-slider";
import { FeaturedProducts } from "@/components/storefront/featured-products";
import { CategorySectionModern } from "@/components/storefront/category-section-modern";
import Link from "next/link";
import Image from "next/image";
import { Truck, Shield, HeadphonesIcon, ArrowRight } from "lucide-react";

export const dynamic = 'force-dynamic';

async function getHomeData() {
    const [sliders, featuredProducts, newProducts, bestSellers, categories, sidebarCategories, banners] =
        await Promise.all([
            prisma.slider.findMany({
                where: { isActive: true },
                orderBy: { order: "asc" },
            }).catch((err) => {
                console.error("Failed to fetch sliders:", err);
                return [];
            }),
            prisma.product.findMany({
                where: { isActive: true, isFeatured: true },
                include: { category: true, brand: true },
                take: 8,
            }).catch((err) => {
                console.error("Failed to fetch featured products:", err);
                return [];
            }),
            prisma.product.findMany({
                where: { isActive: true, isNew: true },
                include: { category: true, brand: true },
                take: 8,
            }).catch((err) => {
                console.error("Failed to fetch new products:", err);
                return [];
            }),
            prisma.product.findMany({
                where: { isActive: true, isBestSeller: true },
                include: { category: true, brand: true },
                take: 8,
            }).catch((err) => {
                console.error("Failed to fetch best sellers:", err);
                return [];
            }),
            prisma.category.findMany({
                where: { isActive: true, isFeatured: true },
                orderBy: { order: "asc" },
                take: 5,
            }).catch((err) => {
                console.error("Failed to fetch categories:", err);
                return [];
            }),
            // Sidebar categories (all active top-level)
            prisma.category.findMany({
                where: {
                    isActive: true,
                    parentId: "cml9exnw20009orv864or2ni2"
                },
                orderBy: { order: "asc" },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    children: {
                        where: { isActive: true },
                        select: { id: true, name: true, slug: true },
                        orderBy: { order: "asc" }
                    }
                }
            }).catch((err) => {
                console.error("Failed to fetch sidebar categories:", err);
                return [];
            }),
            prisma.banner.findMany({
                where: { 
                    isActive: true,
                    imageUrl: { not: "" }
                },
                orderBy: { order: "asc" },
            }).catch((err) => {
                console.error("Failed to fetch banners:", err);
                return [];
            })
        ]);

    const validBanners = banners.filter((b: any) => b.imageUrl && b.imageUrl.trim() !== "");

    const transformProduct = (product: any) => ({
        ...product,
        listPrice: Number(product.listPrice),
        salePrice: product.salePrice ? Number(product.salePrice) : null,
        trendyolPrice: product.trendyolPrice ? Number(product.trendyolPrice) : null,
        n11Price: product.n11Price ? Number(product.n11Price) : null,
        hepsiburadaPrice: product.hepsiburadaPrice ? Number(product.hepsiburadaPrice) : null,
        googlePrice: product.googlePrice ? Number(product.googlePrice) : null,
        weight: product.weight ? Number(product.weight) : null,
        width: product.width ? Number(product.width) : null,
        height: product.height ? Number(product.height) : null,
        length: product.length ? Number(product.length) : null,
        desi: product.desi ? Number(product.desi) : null,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
    });

    const transformCategory = (category: any) => ({
        ...category,
        createdAt: category.createdAt.toISOString(),
    });

    const transformSlider = (slider: any) => ({
        ...slider,
        showOverlay: slider.showOverlay ?? true,
        createdAt: slider.createdAt.toISOString(),
    });

    const transformBanner = (banner: any) => ({
        ...banner,
        createdAt: banner.createdAt.toISOString(),
        updatedAt: banner.updatedAt.toISOString(),
    });

    return {
        sliders: sliders.map(transformSlider),
        featuredProducts: featuredProducts.map(transformProduct),
        newProducts: newProducts.map(transformProduct),
        bestSellers: bestSellers.map(transformProduct),
        categories: categories.map(transformCategory),
        sidebarCategories: sidebarCategories,
        banners: validBanners.map(transformBanner),
    };
}

export default async function HomePage() {
    const session = await auth();
    const data = await getHomeData();
    const discountRate = session?.user?.discountRate || 0;
    const isDealer =
        session?.user?.role === "DEALER" && session?.user?.status === "APPROVED";

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <div className="space-y-12">
                {/* Main Content */}
                <div className="space-y-12">
                    {/* Hero Slider */}
                    <div className="rounded-xl overflow-hidden shadow-sm">
                        <HeroSlider sliders={data.sliders} />
                    </div>

                    {/* Features - Modern Frameless Design */}
                    <section className="grid gap-2 grid-cols-3 py-4 border-y border-gray-100 dark:border-gray-800">
                        <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-3 group text-center md:text-left">
                            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shrink-0">
                                <Truck className="h-5 w-5 text-[#17457C]" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white text-[10px] md:text-sm leading-tight">
                                    Hızlı Teslimat
                                </h3>
                                <p className="hidden md:block text-xs text-gray-500">Aynı gün kargo imkanı</p>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-3 group text-center md:text-left">
                            <div className="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 shrink-0">
                                <Shield className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white text-[10px] md:text-sm leading-tight">
                                    Güvenli Ödeme
                                </h3>
                                <p className="hidden md:block text-xs text-gray-500">256-bit SSL sertifikası</p>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-3 group text-center md:text-left">
                            <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/20 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shrink-0">
                                <HeadphonesIcon className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white text-[10px] md:text-sm leading-tight">
                                    7/24 Destek
                                </h3>
                                <p className="hidden md:block text-xs text-gray-500">Müşteri hizmetleri desteği</p>
                            </div>
                        </div>
                    </section>

                    {/* Categories (Top Row - 2 Large Categories) */}
                    {data.categories.length > 0 && (
                        <CategorySectionModern categories={data.categories} row="top" />
                    )}

                    {/* New Products */}
                    {data.newProducts.length > 0 && (
                        <FeaturedProducts
                            title="Yeni Ürünler"
                            products={data.newProducts}
                            discountRate={discountRate}
                            isDealer={isDealer}
                            badge="Yeni"
                            variant="new"
                        />
                    )}

                    {/* Categories (Bottom Row - 3 Smaller Categories) */}
                    {data.categories.length > 0 && (
                        <CategorySectionModern categories={data.categories} row="bottom" />
                    )}

                    {/* Featured Products */}
                    {data.featuredProducts.length > 0 && (
                        <FeaturedProducts
                            title="Öne Çıkan Ürünler"
                            products={data.featuredProducts}
                            discountRate={discountRate}
                            isDealer={isDealer}
                            variant="featured"
                        />
                    )}

                    {/* Best Sellers */}
                    {data.bestSellers.length > 0 && (
                        <FeaturedProducts
                            title="Çok Satanlar"
                            products={data.bestSellers}
                            discountRate={discountRate}
                            isDealer={isDealer}
                            badge="Popüler"
                            variant="bestseller"
                        />
                    )}
                </div>
            </div>

            {/* Bottom Banners */}
            {data.banners.length > 0 && (
                <section className="mt-12 mb-8">
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                        {data.banners.map((banner: any) => (
                            <Link
                                key={banner.id}
                                href={banner.linkUrl || "#"}
                                className={cn(
                                    "group block",
                                    !banner.linkUrl && "cursor-default"
                                )}
                            >
                                <div className="relative h-48 md:h-64 bg-white rounded-2xl overflow-hidden mb-4 ring-1 ring-black/5 dark:ring-white/10 group-hover:shadow-xl transition-all duration-500">
                                    <Image
                                        src={banner.imageUrl}
                                        alt={banner.title || "Banner"}
                                        fill
                                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                </div>
                                {banner.title && (
                                    <div className="space-y-1.5 px-1">
                                        <h3 className="text-gray-900 dark:text-white font-bold text-lg group-hover:text-[#17457C] transition-colors">
                                            {banner.title}
                                        </h3>
                                        <div className="flex items-center gap-1.5 text-[#17457C] font-bold">
                                            <span className="text-xs uppercase tracking-wider">Ürünleri İncele</span>
                                            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1.5" />
                                        </div>
                                    </div>
                                )}
                            </Link>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
