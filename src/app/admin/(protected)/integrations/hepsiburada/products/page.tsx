
import { prisma } from "@/lib/db";
import { HepsiburadaProductList } from "./hepsiburada-product-list";

export default async function HepsiburadaProductsPage() {
    const products = await prisma.product.findMany({
        include: {
            brand: true,
            categories: true,
            hepsiburadaProduct: true,
            variants: true
        },
        orderBy: { updatedAt: "desc" }
    });

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

            <HepsiburadaProductList initialProducts={JSON.parse(JSON.stringify(products))} />
        </div>
    );
}
