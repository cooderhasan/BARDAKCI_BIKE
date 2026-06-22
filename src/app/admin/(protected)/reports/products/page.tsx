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
import { Package, ArrowLeft, Trophy, Medal } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/helpers";
import { Badge } from "@/components/ui/badge";

async function getTopProducts() {
    // OrderItem'lardan ürün satışlarını grupla
    const topProducts = await prisma.$queryRaw<Array<{
        productId: string;
        productName: string;
        totalQuantity: bigint;
        totalRevenue: number;
        orderCount: bigint;
    }>>`
        SELECT 
            oi."productId",
            oi."productName",
            SUM(oi.quantity) as "totalQuantity",
            SUM(CAST(oi."lineTotal" AS DECIMAL)) as "totalRevenue",
            COUNT(DISTINCT oi."orderId") as "orderCount"
        FROM order_items oi
        GROUP BY oi."productId", oi."productName"
        ORDER BY "totalQuantity" DESC
        LIMIT 20
    `;

    return topProducts.map(p => ({
        productId: p.productId,
        productName: p.productName,
        totalQuantity: Number(p.totalQuantity),
        totalRevenue: Number(p.totalRevenue),
        orderCount: Number(p.orderCount)
    }));
}

export default async function TopProductsReportPage() {
    const topProducts = await getTopProducts();

    const totalQuantitySold = topProducts.reduce((sum, p) => sum + p.totalQuantity, 0);
    const totalRevenue = topProducts.reduce((sum, p) => sum + p.totalRevenue, 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Package className="h-6 w-6 text-green-600" />
                        En Çok Satan Ürünler
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400">
                        Satış performansına göre sıralanmış ürünler
                    </p>
                </div>
                <Link href="/admin/reports">
                    <Button variant="outline">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Raporlar
                    </Button>
                </Link>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Toplam Satılan Adet
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalQuantitySold.toLocaleString("tr-TR")}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Toplam Ciro (Top 20)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatPrice(totalRevenue)}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Ortalama Adet/Ürün
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {topProducts.length > 0 ? Math.round(totalQuantitySold / topProducts.length).toLocaleString("tr-TR") : 0}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Products Table */}
            <Card>
                <CardHeader>
                    <CardTitle>En Çok Satan 20 Ürün</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12">#</TableHead>
                                <TableHead>Ürün Adı</TableHead>
                                <TableHead className="text-center">Satılan Adet</TableHead>
                                <TableHead className="text-center">Sipariş Sayısı</TableHead>
                                <TableHead className="text-right">Toplam Ciro</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {topProducts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                                        Henüz satış verisi bulunmuyor
                                    </TableCell>
                                </TableRow>
                            ) : (
                                topProducts.map((product, index) => (
                                    <TableRow key={product.productId}>
                                        <TableCell>
                                            {index === 0 ? (
                                                <Trophy className="h-5 w-5 text-yellow-500" />
                                            ) : index === 1 ? (
                                                <Medal className="h-5 w-5 text-gray-400" />
                                            ) : index === 2 ? (
                                                <Medal className="h-5 w-5 text-orange-400" />
                                            ) : (
                                                <span className="text-gray-500 font-medium">{index + 1}</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Link
                                                href={`/admin/products/${product.productId}`}
                                                className="font-medium hover:text-[#17457C] transition-colors"
                                            >
                                                {product.productName}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="secondary">
                                                {product.totalQuantity.toLocaleString("tr-TR")}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center text-gray-500">
                                            {product.orderCount}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {formatPrice(product.totalRevenue)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
