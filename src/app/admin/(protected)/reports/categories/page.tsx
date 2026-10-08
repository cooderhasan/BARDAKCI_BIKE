import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { FolderTree, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/helpers";

async function getCategorySales() {
    // Siparişlerdeki ürünleri kategorilerine göre grupla
    const categorySales = await prisma.$queryRaw<Array<{
        categoryId: string | null;
        categoryName: string | null;
        totalQuantity: bigint;
        totalRevenue: number;
        productCount: bigint;
    }>>`
        SELECT 
            p."categoryId",
            c.name as "categoryName",
            SUM(oi.quantity) as "totalQuantity",
            SUM(CAST(oi."lineTotal" AS DECIMAL)) as "totalRevenue",
            COUNT(DISTINCT oi."productId") as "productCount"
        FROM order_items oi
        JOIN products p ON oi."productId" = p.id
        LEFT JOIN categories c ON p."categoryId" = c.id
        GROUP BY p."categoryId", c.name
        ORDER BY "totalRevenue" DESC
    `;

    return categorySales.map(c => ({
        categoryId: c.categoryId,
        categoryName: c.categoryName || "Kategorisiz",
        totalQuantity: Number(c.totalQuantity),
        totalRevenue: Number(c.totalRevenue),
        productCount: Number(c.productCount)
    }));
}

export default async function CategorySalesReportPage() {
    const categorySales = await getCategorySales();

    const totalRevenue = categorySales.reduce((sum, c) => sum + c.totalRevenue, 0);
    const totalQuantity = categorySales.reduce((sum, c) => sum + c.totalQuantity, 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <FolderTree className="h-6 w-6 text-purple-600" />
                        Kategori Satışları
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400">
                        Kategori bazlı satış performansı
                    </p>
                </div>
                <Link href="/admin/reports">
                    <Button variant="outline">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Raporlar
                    </Button>
                </Link>
            </div>

            {/* Summary */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Toplam Kategori
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{categorySales.length}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Toplam Satış Adedi
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalQuantity.toLocaleString("tr-TR")}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Toplam Ciro
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatPrice(totalRevenue)}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Visual Distribution */}
            <Card>
                <CardHeader>
                    <CardTitle>Ciro Dağılımı</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {categorySales.map((category) => {
                            const percentage = totalRevenue > 0 ? (category.totalRevenue / totalRevenue) * 100 : 0;

                            return (
                                <div key={category.categoryId || 'uncategorized'} className="space-y-1">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-medium">{category.categoryName}</span>
                                        <span className="text-gray-500">
                                            {formatPrice(category.totalRevenue)} ({percentage.toFixed(1)}%)
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-3">
                                        <div
                                            className="bg-purple-600 h-3 rounded-full transition-all"
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Categories Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Detaylı Tablo</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Kategori</TableHead>
                                <TableHead className="text-center">Ürün Çeşidi</TableHead>
                                <TableHead className="text-center">Satılan Adet</TableHead>
                                <TableHead className="text-right">Toplam Ciro</TableHead>
                                <TableHead className="text-right">Pay (%)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {categorySales.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                                        Henüz satış verisi bulunmuyor
                                    </TableCell>
                                </TableRow>
                            ) : (
                                categorySales.map((category) => {
                                    const percentage = totalRevenue > 0 ? (category.totalRevenue / totalRevenue) * 100 : 0;

                                    return (
                                        <TableRow key={category.categoryId || 'uncategorized'}>
                                            <TableCell className="font-medium">
                                                {category.categoryName}
                                            </TableCell>
                                            <TableCell className="text-center text-gray-500">
                                                {category.productCount}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {category.totalQuantity.toLocaleString("tr-TR")}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                {formatPrice(category.totalRevenue)}
                                            </TableCell>
                                            <TableCell className="text-right text-gray-500">
                                                {percentage.toFixed(1)}%
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
