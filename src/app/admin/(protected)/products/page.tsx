import { prisma } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductsTable } from "@/components/admin/products-table";
import { Plus } from "lucide-react";

// active: gönderilince/eşleşince true olan bayrak; category: site kategorisindeki eşleşme alanı;
// override: ürüne özel kategori (ilişki + alan); price: pazaryerine gönderilen özel fiyat
const MARKETPLACES: Record<string, { active: string; category: string; override: [string, string]; price: string }> = {
    TRENDYOL: { active: "isTrendyolActive", category: "trendyolCategoryId", override: ["trendyolProduct", "trendyolCategoryId"], price: "trendyolPrice" },
    HEPSIBURADA: { active: "isHepsiburadaActive", category: "hbCategoryId", override: ["hepsiburadaProduct", "hbCategoryId"], price: "hepsiburadaPrice" },
    N11: { active: "isN11Active", category: "n11CategoryId", override: ["n11Product", "n11CategoryId"], price: "n11Price" },
    IDEFIX: { active: "isIdefixActive", category: "idefixCategoryId", override: ["idefixProduct", "idefixCategoryId"], price: "idefixPrice" },
    PAZARAMA: { active: "isPazaramaActive", category: "pazaramaCategoryId", override: ["pazaramaProduct", "pazaramaCategoryId"], price: "pazaramaPrice" },
    PTTAVM: { active: "isPttavmActive", category: "pttavmCategoryId", override: ["pttavmProduct", "pttavmCategoryId"], price: "pttavmPrice" },
    CICEKSEPETI: { active: "isCiceksepetiActive", category: "ciceksepetiCategoryId", override: ["ciceksepetiProduct", "ciceksepetiCategoryId"], price: "ciceksepetiPrice" },
};
const MP_STATUSES = ["UNLINKED", "LINKED", "NO_CATEGORY", "NO_PRICE", "LINKED_NO_PRICE"];

interface ProductsPageProps {
    searchParams: Promise<{
        page?: string;
        search?: string;
        brand?: string;
        stockStatus?: string;
        priceStatus?: string;
        feature?: string;
        store?: string;
        marketplace?: string;
        mpStatus?: string;
    }>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
    const params = await searchParams;
    const page = Number(params.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const search = params.search || "";
    const brandFilter = params.brand || "";
    const stockStatus = params.stockStatus || "ALL";
    const priceStatus = params.priceStatus || "ALL";
    const feature = params.feature || "";
    const storeFilter = params.store || "";
    const marketplace = params.marketplace || "";
    const mpStatus = MP_STATUSES.includes(params.mpStatus || "") ? params.mpStatus! : "UNLINKED";

    // Construct Where Clause
    const where: any = {};

    if (search) {
        where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { sku: { contains: search, mode: "insensitive" } },
            { barcode: { contains: search, mode: "insensitive" } },
        ];
    }

    if (brandFilter && brandFilter !== "ALL") {
        where.brandId = brandFilter;
    }

    if (stockStatus === "IN_STOCK") {
        where.stock = { gt: 0 };
    } else if (stockStatus === "OUT_OF_STOCK") {
        where.stock = { lte: 0 };
    }

    if (priceStatus === "NO_PRICE") {
        where.listPrice = { equals: 0 };
    } else if (priceStatus === "HAS_PRICE") {
        where.listPrice = { gt: 0 };
    }

    if (feature === "featured") {
        where.isFeatured = true;
    } else if (feature === "new") {
        where.isNew = true;
    } else if (feature === "bestseller") {
        where.isBestSeller = true;
    } else if (feature === "discounted") {
        where.salePrice = { gt: 0 };
    } else if (feature === "bundle") {
        where.isBundle = true;
    }

    if (storeFilter === "BIKE" || storeFilter === "MOTOR" || storeFilter === "BOTH") {
        where.store = storeFilter;
    }

    // Pazaryeri filtresi: siteye eklenip pazaryerine bağlanmamış / kategorisi eşleşmemiş / fiyatı girilmemiş ürünler
    const mp = MARKETPLACES[marketplace];
    const and: any[] = [];
    if (mp) {
        if (mpStatus === "LINKED") and.push({ [mp.active]: true });
        else if (mpStatus === "UNLINKED") and.push({ [mp.active]: false });
        else if (mpStatus === "NO_CATEGORY") {
            const [rel, relField] = mp.override;
            and.push(
                { categories: { none: { [mp.category]: { not: null } } } },
                { OR: [{ [rel]: { is: null } }, { [rel]: { is: { [relField]: null } } }] },
            );
        } else if (mpStatus === "NO_PRICE") {
            and.push({ OR: [{ [mp.price]: null }, { [mp.price]: { lte: 0 } }] });
        } else if (mpStatus === "LINKED_NO_PRICE") {
            // Tiki açık ama özel fiyatı yok: pazaryerine site fiyatı gider
            and.push({ [mp.active]: true }, { OR: [{ [mp.price]: null }, { [mp.price]: { lte: 0 } }] });
        }
    } else if (marketplace === "ANY") {
        const flags = Object.values(MARKETPLACES).map((m) => m.active);
        if (mpStatus === "LINKED") and.push({ OR: flags.map((f) => ({ [f]: true })) });
        else and.push(...flags.map((f) => ({ [f]: false })));
    }
    if (and.length) where.AND = and;

    // Parallel Fetch: Products + Total Count + Brands
    const [products, totalCount, brands] = await Promise.all([
        prisma.product.findMany({
            where,
            include: {
                categories: true,
                brand: true,
                variants: { select: { barcode: true, isActive: true } },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        }),
        prisma.product.count({ where }),
        prisma.brand.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
        }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    const serializedProducts = products.map((product) => ({
        ...product,
        listPrice: product.listPrice.toNumber(),
        salePrice: product.salePrice ? product.salePrice.toNumber() : null,
        trendyolPrice: product.trendyolPrice ? product.trendyolPrice.toNumber() : null,
        n11Price: product.n11Price ? product.n11Price.toNumber() : null,
        hepsiburadaPrice: product.hepsiburadaPrice ? product.hepsiburadaPrice.toNumber() : null,
        idefixPrice: product.idefixPrice ? product.idefixPrice.toNumber() : null,
        isTrendyolActive: product.isTrendyolActive,
        isN11Active: product.isN11Active,
        googlePrice: (product as any).googlePrice ? Number((product as any).googlePrice) : null,
        weight: (product as any).weight ? Number((product as any).weight) : null,
        width: (product as any).width ? Number((product as any).width) : null,
        height: (product as any).height ? Number((product as any).height) : null,
        length: (product as any).length ? Number((product as any).length) : null,
        desi: (product as any).desi ? Number((product as any).desi) : null,
    }));

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                        Ürün Yönetimi
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400">
                        Ürünleri arayın, filtreleyin ve yönetin.
                    </p>
                </div>
                <Link href="/admin/products/new">
                    <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Yeni Ürün
                    </Button>
                </Link>
            </div>

            <ProductsTable
                key={`${page}-${search}-${brandFilter}-${stockStatus}-${storeFilter}-${marketplace}-${mpStatus}`}
                products={serializedProducts}
                brands={brands}
                pagination={{
                    currentPage: page,
                    totalPages,
                    totalCount,
                }}
            />
        </div>
    );
}
