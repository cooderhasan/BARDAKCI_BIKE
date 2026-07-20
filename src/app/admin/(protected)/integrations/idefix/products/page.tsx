
import { prisma } from "@/lib/db";
import { IdefixProductList } from "./idefix-product-list";

export default async function IdefixProductsPage() {
  const products = await prisma.product.findMany({
    include: {
      brand: true,
      categories: true,
      idefixProduct: true,
      variants: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-purple-700 dark:text-purple-400 flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
            🛒
          </div>
          Idefix Ürün Yönetimi
        </h1>
        <p className="text-muted-foreground mt-2">
          Ürünlerinizi Idefix kataloğuna gönderin, stok ve fiyatlarını yönetin.
        </p>
      </div>

      <IdefixProductList initialProducts={JSON.parse(JSON.stringify(products))} />
    </div>
  );
}
