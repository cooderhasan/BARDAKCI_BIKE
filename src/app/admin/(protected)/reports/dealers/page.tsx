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
import { Users, ArrowLeft, Trophy, Medal } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/helpers";
import { Badge } from "@/components/ui/badge";

async function getDealerPerformance() {
    const dealerStats = await prisma.$queryRaw<Array<{
        userId: string;
        email: string;
        companyName: string | null;
        orderCount: bigint;
        totalSpent: number;
    }>>`
        SELECT 
            u.id as "userId",
            u.email,
            u."companyName",
            COUNT(o.id) as "orderCount",
            SUM(CAST(o.total AS DECIMAL)) as "totalSpent"
        FROM users u
        JOIN orders o ON u.id = o."userId"
        GROUP BY u.id, u.email, u."companyName"
        ORDER BY "totalSpent" DESC
        LIMIT 20
    `;

    return dealerStats.map(d => ({
        userId: d.userId,
        email: d.email,
        companyName: d.companyName,
        orderCount: Number(d.orderCount),
        totalSpent: Number(d.totalSpent || 0)
    }));
}

export default async function DealerPerformanceReportPage() {
    const dealerStats = await getDealerPerformance();

    const totalDealers = await prisma.user.count({
        where: { role: { in: ["DEALER", "CUSTOMER"] }, status: "APPROVED" }
    });

    const totalRevenue = dealerStats.reduce((sum, d) => sum + d.totalSpent, 0);
    const totalOrders = dealerStats.reduce((sum, d) => sum + d.orderCount, 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Users className="h-6 w-6 text-orange-600" />
                        Bayi Performansı
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400">
                        En aktif müşteriler ve sipariş analizleri
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
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Toplam Aktif Müşteri
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalDealers}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Sipariş Veren Müşteri
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{dealerStats.length}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Toplam Sipariş
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalOrders}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Ortalama Sipariş/Müşteri
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {dealerStats.length > 0 ? (totalOrders / dealerStats.length).toFixed(1) : 0}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Top 3 Highlight */}
            {dealerStats.length >= 3 && (
                <div className="grid gap-4 md:grid-cols-3">
                    {dealerStats.slice(0, 3).map((dealer, index) => (
                        <Card key={dealer.userId} className={
                            index === 0 ? "border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/20" :
                                index === 1 ? "border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800/50" :
                                    "border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-900/20"
                        }>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-4">
                                    {index === 0 ? (
                                        <Trophy className="h-10 w-10 text-yellow-500" />
                                    ) : index === 1 ? (
                                        <Medal className="h-10 w-10 text-gray-400" />
                                    ) : (
                                        <Medal className="h-10 w-10 text-orange-400" />
                                    )}
                                    <div>
                                        <p className="font-bold text-lg">
                                            {dealer.companyName || dealer.email}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            {dealer.orderCount} sipariş • {formatPrice(dealer.totalSpent)}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Dealers Table */}
            <Card>
                <CardHeader>
                    <CardTitle>En Aktif 20 Müşteri</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12">#</TableHead>
                                <TableHead>Müşteri</TableHead>
                                <TableHead>E-posta</TableHead>
                                <TableHead className="text-center">Sipariş Sayısı</TableHead>
                                <TableHead className="text-right">Toplam Harcama</TableHead>
                                <TableHead className="text-right">Ort. Sipariş</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {dealerStats.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                        Henüz sipariş verisi bulunmuyor
                                    </TableCell>
                                </TableRow>
                            ) : (
                                dealerStats.map((dealer, index) => (
                                    <TableRow key={dealer.userId}>
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
                                                href={`/admin/customers`}
                                                className="font-medium hover:text-[#17457C] transition-colors"
                                            >
                                                {dealer.companyName || "-"}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-gray-500">
                                            {dealer.email}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="secondary">
                                                {dealer.orderCount}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {formatPrice(dealer.totalSpent)}
                                        </TableCell>
                                        <TableCell className="text-right text-gray-500">
                                            {formatPrice(dealer.totalSpent / dealer.orderCount)}
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
