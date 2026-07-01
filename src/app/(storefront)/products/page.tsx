import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ProductCardModern } from "@/components/storefront/product-card-modern";
import { ProductFilters } from "@/components/storefront/product-filters";
import { MobileProductFilters } from "@/components/storefront/mobile-product-filters";
import { Prisma } from "@prisma/client";
import { ProductSort } from "@/components/storefront/product-sort";
import { ProductStockToggle } from "@/components/storefront/product-stock-toggle";
import { Pagination } from "@/components/storefront/pagination";
import { Metadata } from "next";

interface ProductsPageProps {
    searchParams: Promise<{
        category?: string;
        search?: string;
        sort?: string;
        min_price?: string;
        max_price?: string;
        brands?: string | string[];
        colors?: string | string[];
        sizes?: string | string[];
        page?: string;
        is_on_sale?: string;
        in_stock?: string;
        genders?: string | string[];
        brakes?: string | string[];
    }>;
}

export async function generateMetadata({ searchParams }: ProductsPageProps): Promise<Metadata> {
    const params = await searchParams;
    let title = "Tüm Ürünler";
    let description = "En kaliteli bisiklet modelleri uygun fiyatlar ve taksit seçenekleriyle.";

    if (params.category) {
        const category = await prisma.category.findUnique({
            where: { slug: params.category },
            select: { name: true }
        });
        if (category) {
            title = category.name;
            description = `${category.name} kategorisindeki ürünleri inceleyin.`;
        }
    } else if (params.search) {
        title = `"${params.search}" Arama Sonuçları`;
        description = `"${params.search}" için bulunan sonuçlar.`;
    } else if (params.is_on_sale === "true") {
        title = "İndirimli Ürünler";
        description = "En uygun fiyatlı bisiklet yedek parça ve fırsat ürünleri.";
    }

    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.bardakcibike.com.tr";

    return {
        title: `${title} | Bardakcı Bike`,
        description,
        alternates: {
            canonical: `${siteUrl}/products`
        },
        openGraph: {
            title: `${title} | Bardakcı Bike`,
            description,
            url: `${siteUrl}/products`,
            type: "website",
        }
    };
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
    const params = await searchParams;
    const session = await auth();
    const discountRate = session?.user?.discountRate || 0;
    const isDealer =
        session?.user?.role === "DEALER" && session?.user?.status === "APPROVED";

    // --- Build Filtering Queries ---
    const where: Prisma.ProductWhereInput = { isActive: true };

    // Category
    if (params.category) {
        const category = await prisma.category.findUnique({
            where: { slug: params.category },
            include: { children: { select: { id: true } } }
        });

        if (category) {
            const categoryIds = [category.id, ...category.children.map(c => c.id)];
            // where.categoryId = { in: categoryIds }; // Legacy field
            (where as any).categories = { some: { id: { in: categoryIds } } };
        } else {
            // If category slug is invalid but provided, verified later by products length being 0 usually, 
            // but strictly we might want to return 404. For now, let it return empty.
            // where.category = { slug: params.category };
            (where as any).categories = { some: { slug: params.category } };
        }
    }

    // Search - Kelime bazlı çoklu arama (her kelime ayrı AND koşulu ile aranır)
    if (params.search) {
        const searchWords = params.search
            .trim()
            .split(/\s+/)
            .filter(w => w.length > 0);

        if (searchWords.length === 1) {
            // Tek kelime: isim, sku, barkod içinde ara
            const word = searchWords[0];
            where.OR = [
                { name: { contains: word, mode: "insensitive" } },
                { sku: { contains: word, mode: "insensitive" } },
                { barcode: { contains: word, mode: "insensitive" } },
                {
                    variants: {
                        some: {
                            OR: [
                                { sku: { contains: word, mode: "insensitive" } },
                                { barcode: { contains: word, mode: "insensitive" } },
                            ],
                        },
                    },
                },
            ];
        } else {
            // Çoklu kelime: her kelimenin ürün adında GEÇMESİ gerekiyor (AND mantığı)
            where.AND = searchWords.map(word => ({
                name: { contains: word, mode: "insensitive" },
            }));
        }
    }


    // Price Range
    if (params.min_price || params.max_price) {
        where.listPrice = {
            gte: params.min_price ? Number(params.min_price) : undefined,
            lte: params.max_price ? Number(params.max_price) : undefined,
        };
    }

    // Brands
    const brandSlugs = typeof params.brands === 'string' ? [params.brands] : params.brands;
    if (brandSlugs && brandSlugs.length > 0) {
        where.brand = { slug: { in: brandSlugs } };
    }

    // Genders
    const genderFilters = typeof params.genders === 'string' ? [params.genders] : params.genders;
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
    const brakeFilters = typeof params.brakes === 'string' ? [params.brakes] : params.brakes;
    if (brakeFilters && brakeFilters.length > 0) {
        where.brakeType = { in: brakeFilters };
    }

    // Variants (Color & Size)
    const colorFilters = typeof params.colors === 'string' ? [params.colors] : params.colors;
    const sizeFilters = typeof params.sizes === 'string' ? [params.sizes] : params.sizes;

    if ((colorFilters && colorFilters.length > 0) || (sizeFilters && sizeFilters.length > 0)) {
        // Let's refine for AND logic between Filter Groups (Brand AND Color AND Size)
        // Prisma `where.variants` with `some` checks if *at least one* variant matches criteria.
        // If we want "Has Red variant" AND "Has Large variant", we might need multiple `some` clauses if they don't need to be the *same* variant.
        // But valid variants are usually what we care about.
        // Let's try to match: Has a variant that is (Color IN colors AND Size IN sizes).

        const variantConditions: Prisma.ProductVariantWhereInput = {};
        if (colorFilters && colorFilters.length > 0) {
            variantConditions.color = { in: colorFilters };
        }
        if (sizeFilters && sizeFilters.length > 0) {
            variantConditions.size = { in: sizeFilters };
        }
        where.variants = { some: variantConditions };
    }

    // Is on Sale
    if (params.is_on_sale === "true") {
        where.salePrice = {
            not: null,
            lt: prisma.product.fields.listPrice
        };
    }

    // In Stock
    if (params.in_stock === "true") {
        where.stock = { gt: 0 };
    }

    // --- Build Sorting ---
    let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: "desc" };
    if (params.sort === "price_asc") {
        orderBy = { listPrice: "asc" };
    } else if (params.sort === "price_desc") {
        orderBy = { listPrice: "desc" };
    } else if (params.sort === "newest") {
        orderBy = { createdAt: "desc" };
    }

    // --- Execute Queries ---
    const PAGE_SIZE = 20;
    const currentPage = params.page ? Number(params.page) : 1;
    const skip = (currentPage - 1) * PAGE_SIZE;

    let sidebarCategories: any[] = [];
    let currentCategory: { name: string; slug: string } | null = null;

    if (params.category) {
        const foundCategory = await prisma.category.findUnique({
            where: { slug: params.category },
            include: { children: { where: { isActive: true }, orderBy: { order: "asc" } } }
        });

        if (foundCategory) {
            currentCategory = foundCategory;
            if (foundCategory.children.length > 0) {
                // Show children
                sidebarCategories = foundCategory.children;
            } else {
                // Show siblings (excluding Root if parent is null)
                if (foundCategory.parentId) {
                    sidebarCategories = await prisma.category.findMany({
                        where: { parentId: foundCategory.parentId, isActive: true },
                        orderBy: { order: "asc" }
                    });
                }
            }
        }
    }

    // If still empty (no category selected OR invalid category OR root fallback), fetch Top Level
    if (sidebarCategories.length === 0) {
        sidebarCategories = await prisma.category.findMany({
            where: { parentId: null, isActive: true },
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

    // Extract unique colors and sizes
    const uniqueColors = Array.from(new Set(variants.map(v => v.color).filter(Boolean))) as string[];
    const uniqueSizes = Array.from(new Set(variants.map(v => v.size).filter(Boolean))) as string[];

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        {currentCategory
                            ? currentCategory.name
                            : params.search
                                ? `"${params.search}" Arama Sonuçları`
                                : params.is_on_sale === "true"
                                    ? "İndirimli Ürünler"
                                    : "Tüm Ürünler"}
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
                        activeCategorySlug={params.category}
                    />
                    <div className="flex items-center gap-3 ml-auto md:ml-0">
                        <ProductStockToggle />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:inline-block">Sıralama:</span>
                        <ProductSort initialSort={params.sort || "newest"} />
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
                            activeCategorySlug={params.category}
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
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Ürün Bulunamadı</h3>
                            <p className="text-gray-500 max-w-sm mx-auto mb-6">
                                Seçtiğiniz kriterlere uygun ürün bulunmamaktadır. Filtreleri temizleyerek tekrar deneyebilirsiniz.
                            </p>
                            <a
                                href="/products"
                                className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-[#17457C] text-white font-medium hover:bg-[#0f3460] transition-colors shadow-lg shadow-blue-500/20"
                            >
                                Filtreleri Temizle
                            </a>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                                {products.map((product) => (
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
                                    />
                                ))}
                            </div>

                            <div className="mt-12">
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    baseUrl="/products"
                                    searchParams={params}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}




