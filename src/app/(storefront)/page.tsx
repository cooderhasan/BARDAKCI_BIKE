import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { HeroSlider } from "@/components/storefront/hero-slider";
import { FeaturedProducts } from "@/components/storefront/featured-products";
import { CategorySectionModern } from "@/components/storefront/category-section-modern";
import Link from "next/link";
import Image from "next/image";
import { Truck, ShieldCheck, CreditCard, Zap, MessageCircle, ArrowRight } from "lucide-react";
import { BrandStrip } from "@/components/storefront/brand-strip";
import { FrameSizeCalculator } from "@/components/storefront/frame-size-calculator";
import { JsonLd } from "@/components/seo/json-ld";
import type { Metadata } from "next";

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
    try {
        const activeStore = await getStoreType();
        const storeSettings = await getStoreSettings(activeStore);

        const isMotor = activeStore === "MOTOR";
        const siteUrl = isMotor ? "https://motor.bardakcibike.com.tr" : (process.env.NEXT_PUBLIC_APP_URL || "https://www.bardakcibike.com.tr");
        const rawTitle = storeSettings.siteTitle || (isMotor ? "Motovitrin - Motosiklet Yedek Parça & Aksesuar" : "Bardakcı Bisiklet");
        const description = storeSettings.seoDescription || (isMotor
            ? "Motovitrin ile en kaliteli motosiklet yedek parça ve aksesuarlarına uygun fiyatlarla ulaşın."
            : "Türkiye'nin lider bisiklet ve bisiklet yedek parça toptan satış platformu.");

        return {
            title: {
                absolute: rawTitle,
            },
            description,
            alternates: {
                canonical: siteUrl,
            },
            openGraph: {
                title: rawTitle,
                description,
                url: siteUrl,
                type: "website",
            }
        };
    } catch (e) {
        return { title: "Bardakcı Bisiklet" };
    }
}


import { getStoreType, getStoreFilter, getStoreSettings } from "@/lib/store-helper";

const safeToISO = (d: any) => {
    if (!d) return new Date().toISOString();
    if (typeof d === "string") return d;
    try {
        return new Date(d).toISOString();
    } catch {
        return new Date().toISOString();
    }
};

async function getHomeData() {
    const activeStore = await getStoreType();
    const storeFilter = getStoreFilter(activeStore);

    const [sliders, featuredProducts, newProducts, bestSellers, categories, sidebarCategories, banners, blogPosts, brands] =
        await Promise.all([
            prisma.slider.findMany({
                where: { isActive: true, store: storeFilter },
                orderBy: { order: "asc" },
            }).catch((err) => {
                console.error("Failed to fetch sliders:", err);
                return [];
            }),
            prisma.product.findMany({
                where: { isActive: true, isFeatured: true, store: storeFilter },
                include: { category: true, brand: true, _count: { select: { variants: true } } },
                // Sabit sıra (önceden sırasızdı; düzenlenen ürün listede yer değiştirebiliyordu)
                orderBy: [{ createdAt: "desc" }, { id: "asc" }],
                take: 8,
            }).catch((err) => {
                console.error("Failed to fetch featured products:", err);
                return [];
            }),
            prisma.product.findMany({
                where: { isActive: true, isNew: true, store: storeFilter },
                include: { category: true, brand: true, _count: { select: { variants: true } } },
                // Sabit sıra (önceden sırasızdı; düzenlenen ürün listede yer değiştirebiliyordu)
                orderBy: [{ createdAt: "desc" }, { id: "asc" }],
                take: 8,
            }).catch((err) => {
                console.error("Failed to fetch new products:", err);
                return [];
            }),
            prisma.product.findMany({
                where: { isActive: true, isBestSeller: true, store: storeFilter },
                include: { category: true, brand: true, _count: { select: { variants: true } } },
                // Sabit sıra (önceden sırasızdı; düzenlenen ürün listede yer değiştirebiliyordu)
                orderBy: [{ createdAt: "desc" }, { id: "asc" }],
                take: 8,
            }).catch((err) => {
                console.error("Failed to fetch best sellers:", err);
                return [];
            }),
            prisma.category.findMany({
                where: { isActive: true, isFeatured: true, store: storeFilter },
                // Sıra eşitse oluşturma tarihine göre: önceden eşit sıradakiler her kayıttan sonra yer değiştiriyordu
                // (ilk 2 = üstteki büyük kartlar, sonraki 3 = alttaki küçük kartlar)
                orderBy: [{ order: "asc" }, { createdAt: "asc" }, { id: "asc" }],
                take: 5,
            }).catch((err) => {
                console.error("Failed to fetch categories:", err);
                return [];
            }),
            // Sidebar categories (all active top-level)
            prisma.category.findMany({
                where: {
                    isActive: true,
                    parentId: null,
                    store: storeFilter,
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
                    imageUrl: { not: "" },
                    store: storeFilter,
                },
                orderBy: { order: "asc" },
            }).catch((err) => {
                console.error("Failed to fetch banners:", err);
                return [];
            }),
            prisma.blogPost.findMany({
                where: { isActive: true },
                orderBy: { createdAt: "desc" },
                take: 3,
            }).catch((err) => {
                console.error("Failed to fetch blog posts:", err);
                return [];
            }),
            // Marka şeridi: logosu olan markalar, en çok ürünü olan önce
            prisma.brand.findMany({
                where: { isActive: true, store: storeFilter, logoUrl: { not: null } },
                orderBy: { products: { _count: "desc" } },
                select: { id: true, name: true, slug: true, logoUrl: true },
                take: 12,
            }).catch((err) => {
                console.error("Failed to fetch brands:", err);
                return [];
            }),
        ]);

    const validBanners = (banners || []).filter((b: any) => b && b.imageUrl && b.imageUrl.trim() !== "");

    const transformProduct = (product: any) => ({
        ...product,
        listPrice: Number(product.listPrice || 0),
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
        createdAt: safeToISO(product.createdAt),
        updatedAt: safeToISO(product.updatedAt),
    });

    const transformCategory = (category: any) => ({
        ...category,
        createdAt: safeToISO(category.createdAt),
    });

    const transformSlider = (slider: any) => ({
        ...slider,
        showOverlay: slider.showOverlay ?? true,
        createdAt: safeToISO(slider.createdAt),
    });

    const transformBanner = (banner: any) => ({
        ...banner,
        createdAt: safeToISO(banner.createdAt),
        updatedAt: safeToISO(banner.updatedAt),
    });

    return {
        sliders: (sliders || []).map(transformSlider),
        featuredProducts: (featuredProducts || []).map(transformProduct),
        newProducts: (newProducts || []).map(transformProduct),
        bestSellers: (bestSellers || []).map(transformProduct),
        categories: (categories || []).map(transformCategory),
        sidebarCategories: sidebarCategories || [],
        banners: validBanners.map(transformBanner),
        blogPosts: blogPosts || [],
        brands: (brands || []).filter((b: any) => b.logoUrl && String(b.logoUrl).trim() !== ""),
    };
}

export default async function HomePage() {
    const session = await auth();
    const activeStore = await getStoreType();
    const isMotor = activeStore === "MOTOR";
    const data = await getHomeData();
    const discountRate = session?.user?.discountRate || 0;
    const isDealer =
        session?.user?.role === "DEALER" && session?.user?.status === "APPROVED";

    const generalSettings = await prisma.siteSettings.findUnique({
        where: { key: "general" },
    }).catch(() => null);
    const general = (generalSettings?.value as any) || {};
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.bardakcibike.com.tr";

    const organizationSchema = {
        "@context": "https://schema.org",
        "@type": "Store",
        "name": general.siteName || "Bardakcı Bike",
        "url": baseUrl,
        "logo": general.logoUrl ? (general.logoUrl.startsWith("http") ? general.logoUrl : `${baseUrl}${general.logoUrl}`) : `${baseUrl}/img/og-default.jpg`,
        "image": `${baseUrl}/img/og-default.jpg`,
        "description": general.seoDescription || "Toptan Bisiklet ve Yedek Parça Satış Platformu",
        "telephone": general.phone || "+905540144142",
        "address": {
            "@type": "PostalAddress",
            "streetAddress": general.address || "Yazır mah. Şafak Cd: No:32B",
            "addressLocality": "Konya",
            "addressRegion": "Selçuklu",
            "addressCountry": "TR"
        },
        "priceRange": "$$",
        "openingHoursSpecification": {
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday"
            ],
            "opens": "09:00",
            "closes": "18:00"
        }
    };

    const websiteSchema = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "url": baseUrl,
        "name": general.siteName || "Bardakcı Bike",
        "potentialAction": {
            "@type": "SearchAction",
            "target": {
                "@type": "EntryPoint",
                "urlTemplate": `${baseUrl}/products?q={search_term_string}`
            },
            "query-input": "required name=search_term_string"
        }
    };

    return (
        <>
            <JsonLd data={organizationSchema} />
            <JsonLd data={websiteSchema} />
            <div className="container mx-auto px-4 py-8 max-w-7xl">
            <div className="space-y-12">
                {/* Main Content */}
                <div className="space-y-12">
                    {/* Hero Slider */}
                    <div className="rounded-xl overflow-hidden shadow-sm">
                        <HeroSlider sliders={data.sliders} />
                    </div>

                    {/* Güven çubuğu: somut bilgiler (önceden "7/24 Destek" gibi genel ifadeler vardı) */}
                    <section className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-4">
                        {(isMotor
                            ? [
                                { icon: Zap, title: "Aynı Gün Kargo", text: "Siparişiniz hızla yola çıkar" },
                                { icon: CreditCard, title: "Taksit İmkânı", text: "Kredi kartına taksit" },
                                { icon: ShieldCheck, title: "Güvenli Ödeme", text: "PayTR 3D Secure" },
                                { icon: MessageCircle, title: "WhatsApp Destek", text: "Parça seçiminde yardım" },
                            ]
                            : [
                                { icon: Zap, title: "Aynı Gün Kargo", text: "Siparişiniz hızla yola çıkar" },
                                { icon: Truck, title: "Ücretsiz Kargo", text: "Tüm bisikletlerde" },
                                { icon: CreditCard, title: "Taksit İmkânı", text: "Kredi kartına taksit" },
                                { icon: ShieldCheck, title: "Güvenli Ödeme", text: "PayTR 3D Secure" },
                            ]
                        ).map(({ icon: Icon, title, text }) => (
                            <div
                                key={title}
                                className="flex items-center gap-2.5 md:gap-3 rounded-xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/60 dark:ring-gray-700 px-3 py-3 md:px-4 md:py-4"
                            >
                                <div className="w-9 h-9 md:w-11 md:h-11 shrink-0 rounded-lg bg-[#17457C]/[0.07] dark:bg-blue-900/30 flex items-center justify-center">
                                    <Icon className="w-[18px] h-[18px] md:w-5 md:h-5 text-[#17457C] dark:text-blue-300" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-gray-900 dark:text-white text-xs md:text-sm leading-tight">{title}</h3>
                                    <p className="text-[11px] md:text-xs text-gray-500 dark:text-gray-400 leading-tight mt-0.5">{text}</p>
                                </div>
                            </div>
                        ))}
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

                    {/* Marka şeridi (logosu yüklenmiş markalar; en az 2 logo yoksa görünmez) */}
                    <BrandStrip brands={data.brands} />

                    {/* Kadro Boyu Hesaplama Robotu */}
                    {!isMotor && (
                        <FrameSizeCalculator categories={data.sidebarCategories} />
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
                                {/* Banner resmi - tam kaplar, kenarlık yok */}
                                <div className="relative h-48 md:h-64 rounded-2xl overflow-hidden mb-4 ring-1 ring-black/5 dark:ring-white/10 group-hover:shadow-xl transition-all duration-500">
                                    <Image
                                        src={banner.imageUrl}
                                        alt={banner.title || "Banner"}
                                        fill
                                        className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
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

            {/* Homepage Blog Posts Showcase */}
            {!isMotor && data.blogPosts && data.blogPosts.length > 0 && (
                <section className="mt-16 mb-8 relative rounded-3xl border border-gray-100 dark:border-gray-800/60 bg-gradient-to-br from-[#17457C]/[0.03] via-white to-white dark:from-blue-950/10 dark:via-gray-900 dark:to-gray-900 p-6 md:p-10 shadow-xs overflow-hidden animate-in fade-in duration-500">
                    {/* Subtle grid pattern for visual coherence with the calculator above */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#17457c03_1px,transparent_1px),linear-gradient(to_bottom,#17457c03_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
                    
                    {/* Glowing highlight in background */}
                    <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative z-10">
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
                            <div>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-[#17457C]/10 text-[#17457C] dark:bg-blue-900/30 dark:text-blue-400 mb-2.5 uppercase tracking-wider">
                                    🚲 Bisiklet Kültürü
                                </span>
                                <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                                    Blog <span className="text-[#17457C]">Rehberleri</span>
                                </h2>
                                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Bisiklet dünyasına dair uzman ipuçları ve faydalı bilgiler</p>
                            </div>
                            <Link 
                                href="/blog"
                                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#17457C] text-white hover:bg-blue-800 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 self-start sm:self-auto"
                            >
                                Tüm Yazıları Gör
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>

                        <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
                            {data.blogPosts.map((post: any) => (
                                <article 
                                    key={post.id} 
                                    className="group bg-white dark:bg-gray-850 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800/80 hover:border-blue-100 dark:hover:border-blue-900/40 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full"
                                >
                                    {/* Image */}
                                    <Link href={`/blog/${post.slug}`} className="relative block aspect-[16/10] overflow-hidden bg-gray-50 dark:bg-gray-950">
                                        {post.imageUrl ? (
                                            <img 
                                                src={post.imageUrl} 
                                                alt={post.title}
                                                className="object-cover w-full h-full group-hover:scale-103 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400 font-semibold text-xs">
                                                Bardakcı Bike
                                            </div>
                                        )}
                                        <div className="absolute top-3 left-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xs px-2.5 py-0.5 rounded-full text-[10px] font-bold text-[#17457C] shadow-xs">
                                            {post.readTime} Dk Okuma
                                        </div>
                                    </Link>

                                    {/* Body */}
                                    <div className="p-5 flex flex-col flex-1">
                                        {/* Date */}
                                        <span className="text-[10px] text-gray-400 mb-2 block font-medium">
                                            {new Date(post.createdAt).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul", 
                                                day: "numeric",
                                                month: "long",
                                                year: "numeric",
                                            })}
                                        </span>

                                        {/* Title */}
                                        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2 group-hover:text-[#17457C] transition-colors leading-snug line-clamp-2">
                                            <Link href={`/blog/${post.slug}`}>
                                                {post.title}
                                            </Link>
                                        </h3>

                                        {/* Summary */}
                                        <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed mb-5 line-clamp-2">
                                            {post.summary || "Detaylar için yazımızı inceleyin."}
                                        </p>

                                        {/* Link */}
                                        <div className="mt-auto pt-3 border-t border-gray-50 dark:border-gray-800/60">
                                            <Link 
                                                href={`/blog/${post.slug}`}
                                                className="inline-flex items-center text-xs font-bold text-[#17457C] hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors group/link"
                                            >
                                                Devamını Gör
                                                <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover/link:translate-x-0.5" />
                                            </Link>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>
            )}
        </div>
        </>
    );
}
