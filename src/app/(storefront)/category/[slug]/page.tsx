import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ProductCardModern } from "@/components/storefront/product-card-modern";
import { ProductFilters } from "@/components/storefront/product-filters";
import { MobileProductFilters } from "@/components/storefront/mobile-product-filters";
import { Prisma } from "@prisma/client";
import { ProductSort } from "@/components/storefront/product-sort";
import { Pagination } from "@/components/storefront/pagination";
import { notFound } from "next/navigation";
import { Metadata } from "next";

interface CategoryPageProps {
    params: Promise<{
        slug: string;
    }>;
    searchParams: Promise<{
        search?: string;
        sort?: string;
        min_price?: string;
        max_price?: string;
        brands?: string | string[];
        colors?: string | string[];
        sizes?: string | string[];
        page?: string;
    }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
    const { slug } = await params;
    const category = await prisma.category.findUnique({
        where: { slug },
        select: { name: true }
    });

    if (!category) return { title: "Kategori Bulunamadı" };

    return {
        title: `${category.name} | Bardakcı Bike`,
        description: `${category.name} kategorisindeki en kaliteli yedek parça ve aksesuarları inceleyin.`,
        alternates: {
            canonical: `${process.env.NEXT_PUBLIC_APP_URL || "https://bardakcibike.com.tr"}/category/${slug}`
        }
    };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
    const { slug } = await params;
    const searchParamsValues = await searchParams;
    const session = await auth();
    const discountRate = session?.user?.discountRate || 0;
    const isDealer = session?.user?.role === "DEALER" && session?.user?.status === "APPROVED";

    // --- Fetch Category ---
    const category = await prisma.category.findUnique({
        where: { slug },
        include: { children: { select: { id: true, name: true, slug: true, imageUrl: true } } }
    });

    if (!category) {
        notFound();
    }

    // --- Build Filtering Queries ---
    const where: Prisma.ProductWhereInput = { isActive: true };

    // Filter by Category (Current + Children)
    const categoryIds = [category.id, ...category.children.map(c => c.id)];
    (where as any).categories = { some: { id: { in: categoryIds } } };


    // Search
    if (searchParamsValues.search) {
        where.OR = [
            { name: { contains: searchParamsValues.search, mode: "insensitive" } },
            { sku: { contains: searchParamsValues.search, mode: "insensitive" } },
            { barcode: { contains: searchParamsValues.search, mode: "insensitive" } },
            {
                variants: {
                    some: {
                        OR: [
                            { sku: { contains: searchParamsValues.search, mode: "insensitive" } },
                            { barcode: { contains: searchParamsValues.search, mode: "insensitive" } },
                        ],
                    },
                },
            },
        ];
    }

    // Price Range
    if (searchParamsValues.min_price || searchParamsValues.max_price) {
        where.listPrice = {
            gte: searchParamsValues.min_price ? Number(searchParamsValues.min_price) : undefined,
            lte: searchParamsValues.max_price ? Number(searchParamsValues.max_price) : undefined,
        };
    }

    // Brands
    const brandSlugs = typeof searchParamsValues.brands === 'string' ? [searchParamsValues.brands] : searchParamsValues.brands;
    if (brandSlugs && brandSlugs.length > 0) {
        where.brand = { slug: { in: brandSlugs } };
    }

    // Variants (Color & Size)
    const colorFilters = typeof searchParamsValues.colors === 'string' ? [searchParamsValues.colors] : searchParamsValues.colors;
    const sizeFilters = typeof searchParamsValues.sizes === 'string' ? [searchParamsValues.sizes] : searchParamsValues.sizes;

    if ((colorFilters && colorFilters.length > 0) || (sizeFilters && sizeFilters.length > 0)) {
        const variantConditions: Prisma.ProductVariantWhereInput = {};
        if (colorFilters && colorFilters.length > 0) {
            variantConditions.color = { in: colorFilters };
        }
        if (sizeFilters && sizeFilters.length > 0) {
            variantConditions.size = { in: sizeFilters };
        }
        where.variants = { some: variantConditions };
    }

    // --- Build Sorting ---
    let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: "desc" };
    if (searchParamsValues.sort === "price_asc") {
        orderBy = { listPrice: "asc" };
    } else if (searchParamsValues.sort === "price_desc") {
        orderBy = { listPrice: "desc" };
    } else if (searchParamsValues.sort === "newest") {
        orderBy = { createdAt: "desc" };
    }

    // --- Execute Queries ---
    const PAGE_SIZE = 20;
    const currentPage = searchParamsValues.page ? Number(searchParamsValues.page) : 1;
    const skip = (currentPage - 1) * PAGE_SIZE;

    // Sidebar Categories (Siblings or Children)
    let sidebarCategories: any[] = [];
    if (category.children.length > 0) {
        sidebarCategories = category.children;
    } else if (category.parentId) {
        sidebarCategories = await prisma.category.findMany({
            where: { parentId: category.parentId, isActive: true },
            orderBy: { order: "asc" }
        });
    } else {
        // Fallback to top level if root logic needed, but for now children or siblings is good.
        // If root category with no children, show nothing or maybe all roots?
        // Let's stick to simple logic: match what products page did.
        const ROOT_CATEGORY_ID = "cml9exnw20009orv864or2ni2";
        sidebarCategories = await prisma.category.findMany({
            where: { parentId: ROOT_CATEGORY_ID, isActive: true },
            orderBy: { order: "asc" },
        });
    }


    const [products, totalCount, brands, variants] = await Promise.all([
        prisma.product.findMany({
            where,
            include: {
                category: true,
                brand: true,
                _count: { select: { variants: true } }
            },
            orderBy,
            skip,
            take: PAGE_SIZE,
        }),
        prisma.product.count({ where }),
        prisma.brand.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
            select: { id: true, name: true, slug: true }
        }),
        prisma.productVariant.findMany({
            where: { isActive: true },
            select: { color: true, size: true },
            distinct: ['color', 'size']
        })
    ]);

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    const uniqueColors = Array.from(new Set(variants.map(v => v.color).filter(Boolean))) as string[];
    const uniqueSizes = Array.from(new Set(variants.map(v => v.size).filter(Boolean))) as string[];

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        {category.name}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        Toplam <span className="font-semibold text-gray-900 dark:text-white">{totalCount}</span> ürün listeleniyor
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <MobileProductFilters
                        categories={sidebarCategories}
                        brands={brands}
                        colors={uniqueColors}
                        sizes={uniqueSizes}
                        activeCategorySlug={slug}
                    />
                    <div className="flex items-center gap-2 ml-auto md:ml-0">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:inline-block">Sıralama:</span>
                        <ProductSort initialSort={searchParamsValues.sort || "newest"} />
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
                {/* Sidebar Filters - Desktop Sticky */}
                <aside className="hidden lg:block w-64 flex-shrink-0 sticky top-24 h-[calc(100vh-6rem)] overflow-y-auto pr-2 custom-scrollbar">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
                        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#009AD0]"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
                            Filtreler
                        </h2>
                        <ProductFilters
                            categories={sidebarCategories}
                            brands={brands}
                            colors={uniqueColors}
                            sizes={uniqueSizes}
                            activeCategorySlug={slug}
                        />
                    </div>
                </aside>

                {/* Products Grid */}
                <div className="flex-1 w-full">
                    {products.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800 text-center">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 text-gray-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Bu kategoride ürün bulunamadı</h3>
                            <p className="text-gray-500 max-w-sm mx-auto mb-6">
                                Kategoride ürün kalmamış olabilir veya filtreleriniz çok kısıtlayıcı olabilir.
                            </p>
                            <a
                                href="/products"
                                className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-[#009AD0] text-white font-medium hover:bg-[#007da8] transition-colors shadow-lg shadow-blue-500/20"
                            >
                                Tüm Ürünleri Gör
                            </a>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
                                {products.map((product, index) => (
                                    <ProductCardModern
                                        key={product.id}
                                        product={{
                                            ...product,
                                            listPrice: Number(product.listPrice),
                                            salePrice: product.salePrice ? Number(product.salePrice) : null,
                                            weight: product.weight ? Number(product.weight) : null,
                                            width: product.width ? Number(product.width) : null,
                                            height: product.height ? Number(product.height) : null,
                                            length: product.length ? Number(product.length) : null,
                                            desi: product.desi ? Number(product.desi) : null,
                                            googlePrice: (product as any).googlePrice ? Number((product as any).googlePrice) : null,
                                        }}
                                        discountRate={discountRate}
                                        isDealer={isDealer}
                                        priority={index < 4}
                                    />
                                ))}
                            </div>

                            <div className="mt-12">
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    baseUrl={`/category/${slug}`}
                                    searchParams={searchParamsValues}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
