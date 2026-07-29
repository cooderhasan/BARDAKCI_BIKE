import { prisma } from "@/lib/db";
import { TrendyolProductList } from "./trendyol-product-list";

interface TrendyolProductsPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    store?: string;
  }>;
}

export default async function TrendyolProductsPage({ searchParams }: TrendyolProductsPageProps) {
  const params = await searchParams;
  const page = Math.max(Number(params.page) || 1, 1);
  const limit = 50;
  const skip = (page - 1) * limit;

  const search = params.search || "";
  const store = params.store || "ALL";

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
      { barcode: { contains: search, mode: "insensitive" } },
    ];
  }
  if (store && store !== "ALL") {
    where.store = store;
  }

  const [products, totalCount] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        brand: true,
        categories: true,
        trendyolProduct: true,
        variants: true,
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-orange-600 dark:text-orange-500 flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
            🟠
          </div>
          Trendyol Ürün Yönetimi
        </h1>
        <p className="text-muted-foreground mt-2">
          Ürünlerinizi Trendyol kataloğuna gönderin, stok ve fiyatlarını anlık yönetin.
        </p>
      </div>

      <TrendyolProductList
        initialProducts={JSON.parse(JSON.stringify(products))}
        pagination={{
          currentPage: page,
          totalPages,
          totalCount,
          limit,
        }}
      />
    </div>
  );
}
