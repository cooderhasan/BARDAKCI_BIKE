import { prisma } from "@/lib/db";
import { ProductForm } from "@/components/admin/product-form";

export default async function NewProductPage() {
    const [categories, brands, settings] = await Promise.all([
        prisma.category.findMany({
            where: {
                isActive: true,
                NOT: {
                    name: { in: ["Root", "Home"] }
                }
            },
            orderBy: { order: "asc" },
            select: { id: true, name: true, parentId: true },
        }),
        prisma.brand.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
        }),
        prisma.siteSettings.findUnique({ where: { key: "general" } })
    ]);

    const defaultCriticalStock = Number((settings?.value as any)?.defaultCriticalStock || 10);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Yeni Ürün Ekle
                </h2>
                <p className="text-gray-500 dark:text-gray-400">
                    Ürün bilgilerini doldurun ve kaydedin.
                </p>
            </div>

            <ProductForm 
                categories={categories} 
                brands={brands} 
                defaultCriticalStock={defaultCriticalStock} 
            />
        </div>
    );
}

