import { prisma } from "@/lib/db";
import { N11ProductList } from "./n11-product-list";

interface N11ProductsPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    store?: string;
  }>;
}

export default async function N11ProductsPage({ searchParams }: N11ProductsPageProps) {
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
        n11Product: true,
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
        <h1 className="text-3xl font-bold tracking-tight text-purple-600 dark:text-purple-500 flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
            🟣
          </div>
          N11 Ürün Yönetimi
        </h1>
        <p className="text-muted-foreground mt-2">
          Ürünlerinizi N11 mağazanıza gönderin ve stoklarınızı eşitleyin.
        </p>
      </div>

      <N11ProductList
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
