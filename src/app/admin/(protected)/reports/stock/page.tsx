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
import { Boxes, ArrowLeft, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

async function getStockStats() {
    const products = await prisma.product.findMany({
        where: { isActive: true },
        select: {
            id: true,
            name: true,
            sku: true,
            stock: true,
            criticalStock: true,
            category: { select: { name: true } },
            brand: { select: { name: true } },
        },
        orderBy: { stock: "asc" }
    });

    const outOfStock = products.filter(p => p.stock === 0);
    const critical = products.filter(p => p.stock > 0 && p.stock <= p.criticalStock);
    const normal = products.filter(p => p.stock > p.criticalStock);

    // Toplam stok değeri (basit hesaplama)
    const totalStock = products.reduce((sum, p) => sum + p.stock, 0);

    return {
        products,
        summary: {
            total: products.length,
            outOfStock: outOfStock.length,
            critical: critical.length,
            normal: normal.length,
            totalStock
        }
    };
}

export default async function StockReportPage() {
    const { products, summary } = await getStockStats();

    const getStockStatus = (stock: number, criticalStock: number) => {
        if (stock === 0) return { label: "Tükendi", color: "bg-red-100 text-red-800", icon: XCircle };
        if (stock <= criticalStock) return { label: "Kritik", color: "bg-orange-100 text-orange-800", icon: AlertTriangle };
        return { label: "Normal", color: "bg-green-100 text-green-800", icon: CheckCircle };
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Boxes className="h-6 w-6 text-red-600" />
                        Stok Durumu Raporu
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400">
                        Tüm ürünlerin stok analizi
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Toplam Ürün
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.total}</div>
                    </CardContent>
                </Card>

                <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-green-700 flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" />
                            Normal Stok
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-800">{summary.normal}</div>
                    </CardContent>
                </Card>

                <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-orange-700 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            Kritik Seviye
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-800">{summary.critical}</div>
                    </CardContent>
                </Card>

                <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-red-700 flex items-center gap-2">
                            <XCircle className="h-4 w-4" />
                            Stokta Yok
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-800">{summary.outOfStock}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Toplam Stok Adedi
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.totalStock.toLocaleString("tr-TR")}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Distribution Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>Stok Dağılımı</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2 h-8 rounded-lg overflow-hidden">
                        <div
                            className="bg-green-500 h-full transition-all flex items-center justify-center text-white text-xs font-medium"
                            style={{ width: `${(summary.normal / summary.total) * 100}%` }}
                        >
                            {summary.normal > 0 && `${Math.round((summary.normal / summary.total) * 100)}%`}
                        </div>
                        <div
                            className="bg-orange-500 h-full transition-all flex items-center justify-center text-white text-xs font-medium"
                            style={{ width: `${(summary.critical / summary.total) * 100}%` }}
                        >
                            {summary.critical > 0 && `${Math.round((summary.critical / summary.total) * 100)}%`}
                        </div>
                        <div
                            className="bg-red-500 h-full transition-all flex items-center justify-center text-white text-xs font-medium"
                            style={{ width: `${(summary.outOfStock / summary.total) * 100}%` }}
                        >
                            {summary.outOfStock > 0 && `${Math.round((summary.outOfStock / summary.total) * 100)}%`}
                        </div>
                    </div>
                    <div className="flex items-center justify-center gap-6 mt-4 text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-green-500" />
                            <span>Normal</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-orange-500" />
                            <span>Kritik</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded bg-red-500" />
                            <span>Tükendi</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Products Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Tüm Ürünler (Stok Durumuna Göre)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="max-h-[600px] overflow-auto">
                        <Table>
                            <TableHeader className="sticky top-0 bg-white dark:bg-gray-800">
                                <TableRow>
                                    <TableHead>Ürün</TableHead>
                                    <TableHead>Stok Kodu</TableHead>
                                    <TableHead>Kategori</TableHead>
                                    <TableHead>Marka</TableHead>
                                    <TableHead className="text-center">Stok</TableHead>
                                    <TableHead className="text-center">Kritik Seviye</TableHead>
                                    <TableHead>Durum</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {products.map((product) => {
                                    const status = getStockStatus(product.stock, product.criticalStock);
                                    const StatusIcon = status.icon;

                                    return (
                                        <TableRow key={product.id}>
                                            <TableCell>
                                                <Link
                                                    href={`/admin/products/${product.id}`}
                                                    className="font-medium hover:text-[#17457C] transition-colors"
                                                >
                                                    {product.name}
                                                </Link>
                                            </TableCell>
                                            <TableCell className="text-gray-500">
                                                {product.sku || "-"}
                                            </TableCell>
                                            <TableCell className="text-gray-500">
                                                {product.category?.name || "-"}
                                            </TableCell>
                                            <TableCell className="text-gray-500">
                                                {product.brand?.name || "-"}
                                            </TableCell>
                                            <TableCell className="text-center font-medium">
                                                {product.stock}
                                            </TableCell>
                                            <TableCell className="text-center text-gray-500">
                                                {product.criticalStock}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={`${status.color} flex items-center gap-1 w-fit`}>
                                                    <StatusIcon className="h-3 w-3" />
                                                    {status.label}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
