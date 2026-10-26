import { prisma } from "@/lib/db";
import { CategoriesTable } from "@/components/admin/categories-table";

export default async function CategoriesPage() {
    const categories = await prisma.category.findMany({
        orderBy: { order: "asc" },
        include: {
            _count: {
                select: { products: true },
            },
            parent: {
                select: { name: true },
            },
        },
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                    Kategori Yönetimi
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Ürün kategorilerini yönetin
                </p>
            </div>

            <CategoriesTable categories={categories} />
        </div>
    );
}
