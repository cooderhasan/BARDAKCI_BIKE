import { prisma } from "@/lib/db";
import { BulkPriceForm } from "@/components/admin/bulk-price-form";
import { BulkStockForm } from "@/components/admin/bulk-stock-form";
import { BulkTrendyolPriceForm } from "@/components/admin/bulk-trendyol-price-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function BulkUpdatesPage() {
    const [categories, brands] = await Promise.all([
        prisma.category.findMany({
            where: {
                isActive: true,
                NOT: [
                    { name: 'Root' },
                    { name: 'Home' }
                ]
            },
            orderBy: { order: "asc" },
            select: { id: true, name: true, parentId: true },
        }),
        prisma.brand.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
        }),
    ]);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Toplu İşlemler
                </h2>
                <p className="text-gray-500 dark:text-gray-400">
                    Ürün fiyatlarını veya stoklarını marka/kategori bazında toplu olarak güncelleyin.
                </p>
            </div>

            <Tabs defaultValue="price" className="w-full">
                <TabsList className="grid w-full grid-cols-3 max-w-[600px]">
                    <TabsTrigger value="price">Fiyat Güncelleme</TabsTrigger>
                    <TabsTrigger value="trendyol">Trendyol Fiyatları</TabsTrigger>
                    <TabsTrigger value="stock">Stok Güncelleme</TabsTrigger>
                </TabsList>
                <TabsContent value="price" className="mt-6">
                    <BulkPriceForm categories={categories} brands={brands} />
                </TabsContent>
                <TabsContent value="trendyol" className="mt-6">
                    <BulkTrendyolPriceForm categories={categories} brands={brands} />
                </TabsContent>
                <TabsContent value="stock" className="mt-6">
                    <BulkStockForm categories={categories} brands={brands} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
