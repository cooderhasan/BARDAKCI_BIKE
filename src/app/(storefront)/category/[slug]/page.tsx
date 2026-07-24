import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ProductCardModern } from "@/components/storefront/product-card-modern";
import { ProductFilters } from "@/components/storefront/product-filters";
import { MobileProductFilters } from "@/components/storefront/mobile-product-filters";
import { Prisma } from "@prisma/client";
import { ProductSort } from "@/components/storefront/product-sort";
import { ProductStockToggle } from "@/components/storefront/product-stock-toggle";
import { Pagination } from "@/components/storefront/pagination";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export const dynamic = 'force-dynamic';

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
        in_stock?: string;
        genders?: string | string[];
        brakes?: string | string[];
    }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
    const { slug } = await params;
    const category = await prisma.category.findUnique({
        where: { slug },
        select: { name: true, imageUrl: true }
    });

    if (!category) return { title: "Kategori Bulunamadı" };

    // Turkish Title Case Helper Function
    const toTitleCase = (str: string) => {
        return str.toLowerCase().replace(/(?:^|[\s-/])\S/g, (match) => {
            return match.toLocaleUpperCase('tr-TR');
        });
    };
    
    const formattedName = toTitleCase(category.name);
    const seoTitle = `${formattedName} Ürünleri`;

    const description = `${formattedName} kategorisindeki en kaliteli ürünleri inceleyin ve karşılaştırın.`;
    const imageUrl = category.imageUrl || "/img/og-default.jpg";

    return {
        title: seoTitle, // Root layout will automatically append " | storeTitle"
        description,
        alternates: {
            canonical: `/category/${slug}`
        },
        openGraph: {
            title: seoTitle,
            description,
            url: `/category/${slug}`,
            images: [{ url: imageUrl }],
            type: "website",
        }
    };
}


import { getStoreType, getStoreFilter } from "@/lib/store-helper";

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
    const { slug } = await params;
    const searchParamsValues = await searchParams;
    const session = await auth();
    const activeStore = await getStoreType();
    const isMotor = activeStore === "MOTOR";
    const storeFilter = getStoreFilter(activeStore);
    const discountRate = session?.user?.discountRate || 0;
    const isDealer = session?.user?.role === "DEALER" && session?.user?.status === "APPROVED";

    // --- Fetch Category ---
    const category = await prisma.category.findUnique({
        where: { slug },
        include: { 
            children: {
                where: { isActive: true, store: storeFilter as any },
                select: { id: true, name: true, slug: true, imageUrl: true }
            },
            parent: {
                include: {
                    parent: true
                }
            }
        }
    });

    if (!category) {
        notFound();
    }

    const getCategoryPath = (cat: any) => {
        const path = [];
        let current = cat;
        while (current) {
            path.unshift(current);
            current = current.parent;
        }
        return path;
    };
    const categoryPath = getCategoryPath(category);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.bardakcibike.com.tr";
    const breadcrumbListItems = [
        {
            "@type": "ListItem",
            "position": 1,
            "name": "Ana Sayfa",
            "item": baseUrl,
        }
    ];
    categoryPath.forEach((cat: any, index: number) => {
        breadcrumbListItems.push({
            "@type": "ListItem",
            "position": index + 2,
            "name": cat.name,
            "item": `${baseUrl}/category/${cat.slug}`,
        });
    });
    const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": breadcrumbListItems,
    };


    // --- Build Filtering Queries ---
    const andConditions: Prisma.ProductWhereInput[] = [{ isActive: true }, { store: storeFilter as any }];

    // Filter by Category: hem eski categoryId (legacy) hem yeni categories many-to-many kapsansın
    const categoryIds = [category.id, ...category.children.map(c => c.id)];
    andConditions.push({
        OR: [
            { categories: { some: { id: { in: categoryIds } } } } as Prisma.ProductWhereInput,
            { categoryId: { in: categoryIds } },
        ]
    });

    // In Stock
    if (searchParamsValues.in_stock === "true") {
        andConditions.push({
            stock: { gt: 0 }
        });
    }

    const where: Prisma.ProductWhereInput = { AND: andConditions };

    // Search
    if (searchParamsValues.search) {
        andConditions.push({
            OR: [
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
            ],
        });
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

    // Genders
    const genderFilters = typeof searchParamsValues.genders === 'string' ? [searchParamsValues.genders] : searchParamsValues.genders;
    if (genderFilters && genderFilters.length > 0) {
        const queryGenders = [...genderFilters];
        if (genderFilters.includes("Erkek") || genderFilters.includes("Kadın")) {
            if (!queryGenders.includes("Unisex")) {
                queryGenders.push("Unisex");
            }
        }
        where.gender = { in: queryGenders };
    }

    // Brakes
    const brakeFilters = typeof searchParamsValues.brakes === 'string' ? [searchParamsValues.brakes] : searchParamsValues.brakes;
    if (brakeFilters && brakeFilters.length > 0) {
        where.brakeType = { in: brakeFilters };
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
            where: { parentId: category.parentId, isActive: true, store: storeFilter as any },
            orderBy: { order: "asc" }
        });
    } else {
        sidebarCategories = await prisma.category.findMany({
            where: { parentId: null, isActive: true, store: storeFilter as any },
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
            where: { 
                isActive: true,
                store: getStoreFilter(activeStore)
            },
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
        <>
            <JsonLd data={breadcrumbSchema} />
            <div className="container mx-auto px-4 py-8">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6 overflow-x-auto whitespace-nowrap">
                <Link href="/" className="hover:text-[#17457C] transition-colors">
                    Ana Sayfa
                </Link>
                {categoryPath.map((cat: any, index: number) => (
                    <div key={cat.id} className="flex items-center gap-1.5 animate-in fade-in slide-in-from-left-1 duration-300">
                        <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                        {index === categoryPath.length - 1 ? (
                            <span className="text-gray-900 dark:text-white font-medium">
                                {cat.name}
                            </span>
                        ) : (
                            <Link
                                href={`/category/${cat.slug}`}
                                className="hover:text-[#17457C] transition-colors"
                            >
                                {cat.name}
                            </Link>
                        )}
                    </div>
                ))}
            </nav>

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
                        isMotor={isMotor}
                    />
                    <div className="flex items-center gap-3 ml-auto md:ml-0">
                        <ProductStockToggle />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:inline-block">Sıralama:</span>
                        <ProductSort initialSort={searchParamsValues.sort || "newest"} />
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
                {/* Sidebar Filters - Desktop Sticky */}
                <aside className="hidden lg:block w-72 flex-shrink-0 sticky top-24 pr-2">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
                        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#17457C]"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
                            Filtreler
                        </h2>
                        <ProductFilters
                            categories={sidebarCategories}
                            brands={brands}
                            colors={uniqueColors}
                            sizes={uniqueSizes}
                            activeCategorySlug={slug}
                            isMotor={isMotor}
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
                                className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-[#17457C] text-white font-medium hover:bg-[#0f3460] transition-colors shadow-lg shadow-blue-500/20"
                            >
                                Tüm Ürünleri Gör
                            </a>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
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

            {/* Category SEO Description */}
            {category.description && (
                <div className="mt-16 bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 shadow-xs max-w-none text-gray-600 dark:text-gray-300 leading-relaxed prose prose-blue dark:prose-invert">
                    <div dangerouslySetInnerHTML={{ __html: category.description }} />
                </div>
            )}
        </div>
        </>
    );
}
