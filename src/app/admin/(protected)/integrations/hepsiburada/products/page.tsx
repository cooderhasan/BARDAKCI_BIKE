import { prisma } from "@/lib/db";
import { HepsiburadaProductList } from "./hepsiburada-product-list";

interface HepsiburadaProductsPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    store?: string;
  }>;
}

export default async function HepsiburadaProductsPage({ searchParams }: HepsiburadaProductsPageProps) {
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
        hepsiburadaProduct: true,
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
        <h1 className="text-3xl font-bold tracking-tight text-[#17457C] dark:text-blue-500 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
            🔵
          </div>
          Hepsiburada Ürün Yönetimi
        </h1>
        <p className="text-muted-foreground mt-2">
          Hepsiburada kataloğu ile ürünlerinizi eşleştirin veya yeni ürün talebi oluşturun.
        </p>
      </div>

      <HepsiburadaProductList
        key={`${page}-${search}-${store}`}
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
