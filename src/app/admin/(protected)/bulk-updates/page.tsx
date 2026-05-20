import { prisma } from "@/lib/db";
import { BulkPriceForm } from "@/components/admin/bulk-price-form";
import { BulkStockForm } from "@/components/admin/bulk-stock-form";
import { BulkTrendyolPriceForm } from "@/components/admin/bulk-trendyol-price-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { BulkN11PriceForm } from "@/components/admin/bulk-n11-price-form";
import { BulkHbPriceForm } from "@/components/admin/bulk-hb-price-form";
import { BulkPriceTransferForm } from "@/components/admin/bulk-price-transfer-form";

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
                <TabsList className="grid w-full grid-cols-6 max-w-[1200px]">
                    <TabsTrigger value="price">Ana Fiyat</TabsTrigger>
                    <TabsTrigger value="trendyol">Trendyol Fiyatları</TabsTrigger>
                    <TabsTrigger value="n11">N11 Fiyatları</TabsTrigger>
                    <TabsTrigger value="hepsiburada">HB Fiyatları</TabsTrigger>
                    <TabsTrigger value="transfer" className="text-emerald-700 bg-emerald-50/50">Fiyat Transferi</TabsTrigger>
                    <TabsTrigger value="stock">Stoklar</TabsTrigger>
                </TabsList>
                <TabsContent value="price" className="mt-6">
                    <BulkPriceForm categories={categories} brands={brands} />
                </TabsContent>
                <TabsContent value="trendyol" className="mt-6">
                    <BulkTrendyolPriceForm categories={categories} brands={brands} />
                </TabsContent>
                <TabsContent value="n11" className="mt-6">
                    <BulkN11PriceForm categories={categories} brands={brands} />
                </TabsContent>
                <TabsContent value="hepsiburada" className="mt-6">
                    <BulkHbPriceForm categories={categories} brands={brands} />
                </TabsContent>
                <TabsContent value="transfer" className="mt-6">
                    <BulkPriceTransferForm categories={categories} brands={brands} />
                </TabsContent>
                <TabsContent value="stock" className="mt-6">
                    <BulkStockForm categories={categories} brands={brands} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
