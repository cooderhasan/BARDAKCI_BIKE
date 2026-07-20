import { prisma } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductsTable } from "@/components/admin/products-table";
import { Plus } from "lucide-react";

interface ProductsPageProps {
    searchParams: Promise<{
        page?: string;
        search?: string;
        brand?: string;
        stockStatus?: string;
        priceStatus?: string;
        feature?: string;
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
    }

    // Parallel Fetch: Products + Total Count + Brands
    const [products, totalCount, brands] = await Promise.all([
        prisma.product.findMany({
            where,
            include: {
                categories: true,
                brand: true,
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
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
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
