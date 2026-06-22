import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    TrendingUp,
    TrendingDown,
    ShoppingCart,
    DollarSign,
    Package,
    ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/helpers";

async function getSalesStats() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay());
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Bugünün siparişleri
    const todayOrders = await prisma.order.findMany({
        where: { createdAt: { gte: today } },
        select: { total: true }
    });
    const todayTotal = todayOrders.reduce((sum, o) => sum + Number(o.total), 0);

    // Bu haftanın siparişleri
    const thisWeekOrders = await prisma.order.findMany({
        where: { createdAt: { gte: thisWeekStart } },
        select: { total: true }
    });
    const thisWeekTotal = thisWeekOrders.reduce((sum, o) => sum + Number(o.total), 0);

    // Bu ayın siparişleri
    const thisMonthOrders = await prisma.order.findMany({
        where: { createdAt: { gte: thisMonthStart } },
        select: { total: true }
    });
    const thisMonthTotal = thisMonthOrders.reduce((sum, o) => sum + Number(o.total), 0);

    // Geçen ayın siparişleri (karşılaştırma için)
    const lastMonthOrders = await prisma.order.findMany({
        where: {
            createdAt: { gte: lastMonthStart, lte: lastMonthEnd }
        },
        select: { total: true }
    });
    const lastMonthTotal = lastMonthOrders.reduce((sum, o) => sum + Number(o.total), 0);

    // Genel istatistikler
    const totalOrders = await prisma.order.count();
    const allOrders = await prisma.order.findMany({
        select: { total: true }
    });
    const totalRevenue = allOrders.reduce((sum, o) => sum + Number(o.total), 0);

    // Ortalama sipariş değeri
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Son 7 günün günlük satışları
    const last7Days: { date: string; total: number; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const nextDate = new Date(date);
        nextDate.setDate(date.getDate() + 1);

        const dayOrders = await prisma.order.findMany({
            where: {
                createdAt: { gte: date, lt: nextDate }
            },
            select: { total: true }
        });

        last7Days.push({
            date: date.toLocaleDateString("tr-TR", { weekday: "short", day: "numeric" }),
            total: dayOrders.reduce((sum, o) => sum + Number(o.total), 0),
            count: dayOrders.length
        });
    }

    return {
        today: { total: todayTotal, count: todayOrders.length },
        thisWeek: { total: thisWeekTotal, count: thisWeekOrders.length },
        thisMonth: { total: thisMonthTotal, count: thisMonthOrders.length },
        lastMonth: { total: lastMonthTotal, count: lastMonthOrders.length },
        overall: { total: totalRevenue, count: totalOrders, avg: avgOrderValue },
        last7Days
    };
}

export default async function SalesReportPage() {
    const stats = await getSalesStats();

    const monthlyGrowth = stats.lastMonth.total > 0
        ? ((stats.thisMonth.total - stats.lastMonth.total) / stats.lastMonth.total * 100).toFixed(1)
        : "0";

    const isGrowthPositive = Number(monthlyGrowth) >= 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <TrendingUp className="h-6 w-6 text-[#17457C]" />
                        Satış Özeti
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400">
                        Dönemsel satış analizi
                    </p>
                </div>
                <Link href="/admin/reports">
                    <Button variant="outline">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Raporlar
                    </Button>
                </Link>
            </div>

            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Bugün
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatPrice(stats.today.total)}</div>
                        <p className="text-xs text-gray-500">{stats.today.count} sipariş</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Bu Hafta
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatPrice(stats.thisWeek.total)}</div>
                        <p className="text-xs text-gray-500">{stats.thisWeek.count} sipariş</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Bu Ay
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatPrice(stats.thisMonth.total)}</div>
                        <div className="flex items-center gap-1 mt-1">
                            {isGrowthPositive ? (
                                <TrendingUp className="h-3 w-3 text-green-500" />
                            ) : (
                                <TrendingDown className="h-3 w-3 text-red-500" />
                            )}
                            <span className={`text-xs ${isGrowthPositive ? 'text-green-600' : 'text-red-600'}`}>
                                {isGrowthPositive ? '+' : ''}{monthlyGrowth}% geçen aya göre
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Ortalama Sipariş
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatPrice(stats.overall.avg)}</div>
                        <p className="text-xs text-gray-500">{stats.overall.count} toplam sipariş</p>
                    </CardContent>
                </Card>
            </div>

            {/* Overall Stats */}
            <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                <CardContent className="py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-blue-100 text-sm">Toplam Ciro</p>
                            <p className="text-4xl font-bold">{formatPrice(stats.overall.total)}</p>
                        </div>
                        <DollarSign className="h-16 w-16 text-blue-200/50" />
                    </div>
                </CardContent>
            </Card>

            {/* Last 7 Days */}
            <Card>
                <CardHeader>
                    <CardTitle>Son 7 Gün</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {stats.last7Days.map((day, index) => {
                            const maxTotal = Math.max(...stats.last7Days.map(d => d.total));
                            const percentage = maxTotal > 0 ? (day.total / maxTotal) * 100 : 0;

                            return (
                                <div key={index} className="space-y-1">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-medium">{day.date}</span>
                                        <span className="text-gray-500">
                                            {formatPrice(day.total)} ({day.count} sipariş)
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2">
                                        <div
                                            className="bg-[#17457C] h-2 rounded-full transition-all"
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
