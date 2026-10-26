import { prisma } from "@/lib/db";
import type { OrderStatus, Prisma } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/helpers";
import { ORDER_SOURCE_LABELS, NON_REVENUE_STATUSES } from "@/lib/order-sources";

export const dynamic = "force-dynamic";

// Türkiye UTC+3 (yaz saati yok). Sunucu UTC çalıştığı için gün/ay sınırları buna göre hesaplanır.
const TR_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Türkiye takvimine göre y/m/d gününün başlangıcı (UTC Date olarak); taşan gün/ay değerleri normalize edilir */
const trDayStart = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d) - TR_OFFSET_MS);

const revenueWhere: Prisma.OrderWhereInput = { status: { notIn: [...NON_REVENUE_STATUSES] as OrderStatus[] } };

type Totals = { total: number; count: number };
type Period = { key: string; label: string; gte?: Date; lt?: Date };

async function sumRange(gte?: Date, lt?: Date): Promise<Totals> {
    const r = await prisma.order.aggregate({
        where: { ...revenueWhere, createdAt: { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) } },
        _sum: { total: true },
        _count: { _all: true },
    });
    return { total: Number(r._sum.total || 0), count: r._count._all };
}

async function bySourceRange(gte?: Date, lt?: Date): Promise<Map<string, Totals>> {
    const rows = await prisma.order.groupBy({
        by: ["source"],
        where: { ...revenueWhere, createdAt: { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) } },
        _sum: { total: true },
        _count: { _all: true },
    });
    const map = new Map<string, Totals>();
    for (const r of rows as any[]) {
        const key = r.source || "WEB";
        const cur = map.get(key) || { total: 0, count: 0 };
        map.set(key, { total: cur.total + Number(r._sum?.total || 0), count: cur.count + (r._count?._all || 0) });
    }
    return map;
}

async function getSalesStats() {
    const now = new Date();
    const nowTr = new Date(now.getTime() + TR_OFFSET_MS); // UTC getter'ları Türkiye takvimini verir
    const y = nowTr.getUTCFullYear();
    const m = nowTr.getUTCMonth();
    const d = nowTr.getUTCDate();
    const dowMon = (nowTr.getUTCDay() + 6) % 7; // Pazartesi = 0

    const today = trDayStart(y, m, d);
    const weekStart = trDayStart(y, m, d - dowMon);
    const monthStart = trDayStart(y, m, 1);
    const lastMonthStart = trDayStart(y, m - 1, 1);
    // Geçen ayın aynı dönemi: 1'inden bugünün aynı gün/saatine kadar (geçen ay daha kısaysa ay sonuyla sınırlı)
    const lastMonthSamePeriodEnd = new Date(Math.min(lastMonthStart.getTime() + (now.getTime() - monthStart.getTime()), monthStart.getTime()));

    const periods: Period[] = [
        { key: "today", label: "Bugün", gte: today },
        { key: "week", label: "Bu Hafta", gte: weekStart },
        { key: "month", label: "Bu Ay", gte: monthStart },
        { key: "lastMonth", label: "Geçen Ay", gte: lastMonthStart, lt: monthStart },
        { key: "all", label: "Tüm Zamanlar" },
    ];

    const last7Ranges = Array.from({ length: 7 }, (_, i) => {
        const start = trDayStart(y, m, d - (6 - i));
        return { start, end: new Date(start.getTime() + DAY_MS) };
    });

    const [periodTotals, periodSources, lastMonthSame, cancelled, unpaid, last7] = await Promise.all([
        Promise.all(periods.map((p) => sumRange(p.gte, p.lt))),
        Promise.all(periods.map((p) => bySourceRange(p.gte, p.lt))),
        sumRange(lastMonthStart, lastMonthSamePeriodEnd),
        prisma.order.aggregate({ where: { status: "CANCELLED" }, _sum: { total: true }, _count: { _all: true } }),
        prisma.order.aggregate({ where: { status: "WAITING_FOR_PAYMENT" }, _sum: { total: true }, _count: { _all: true } }),
        Promise.all(last7Ranges.map((r) => sumRange(r.start, r.end))),
    ]);

    const byKey = Object.fromEntries(periods.map((p, i) => [p.key, periodTotals[i]])) as Record<string, Totals>;

    // Pazaryeri kırılımı tablosu: tüm zamanlar cirosuna göre sıralı
    const allSources = periodSources[periods.length - 1];
    const sourceKeys = Array.from(allSources.keys()).sort((a, b) => (allSources.get(b)!.total - allSources.get(a)!.total));
    const sourceRows = sourceKeys.map((src) => ({
        src,
        label: ORDER_SOURCE_LABELS[src] || src,
        cells: periodSources.map((map) => map.get(src) || { total: 0, count: 0 }),
    }));

    return {
        periods,
        byKey,
        lastMonthSame,
        sourceRows,
        cancelled: { total: Number(cancelled._sum.total || 0), count: cancelled._count._all },
        unpaid: { total: Number(unpaid._sum.total || 0), count: unpaid._count._all },
        last7Days: last7Ranges.map((r, i) => ({
            date: r.start.toLocaleDateString("tr-TR", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Istanbul" }),
            ...last7[i],
        })),
    };
}

export default async function SalesReportPage() {
    const stats = await getSalesStats();
    const { today, week, month, all } = stats.byKey;
    const avgOrderValue = all.count > 0 ? all.total / all.count : 0;

    const growth = stats.lastMonthSame.total > 0
        ? ((month.total - stats.lastMonthSame.total) / stats.lastMonthSame.total) * 100
        : null;
    const isGrowthPositive = (growth ?? 0) >= 0;
    const maxDay = Math.max(...stats.last7Days.map((d) => d.total));

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
                        <TrendingUp className="h-6 w-6 text-[#17457C]" />
                        Satış Özeti
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400">
                        Dönemsel satış analizi · iptal ve ödeme bekleyen siparişler hariç, Türkiye saatine göre
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Bugün</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatPrice(today.total)}</div>
                        <p className="text-xs text-gray-500">{today.count} sipariş</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Bu Hafta (Pazartesiden beri)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatPrice(week.total)}</div>
                        <p className="text-xs text-gray-500">{week.count} sipariş</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Bu Ay</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatPrice(month.total)}</div>
                        <p className="text-xs text-gray-500">{month.count} sipariş</p>
                        {growth !== null && (
                            <div className="flex items-center gap-1 mt-1">
                                {isGrowthPositive ? (
                                    <TrendingUp className="h-3 w-3 text-green-500" />
                                ) : (
                                    <TrendingDown className="h-3 w-3 text-red-500" />
                                )}
                                <span className={`text-xs ${isGrowthPositive ? "text-green-600" : "text-red-600"}`}>
                                    {isGrowthPositive ? "+" : ""}{growth.toFixed(1)}% geçen ayın aynı dönemine göre
                                </span>
                            </div>
                        )}
                        <p className="text-[11px] text-gray-400 mt-0.5">
                            Geçen ay aynı dönem: {formatPrice(stats.lastMonthSame.total)} · ay toplamı {formatPrice(stats.byKey.lastMonth.total)}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Ortalama Sipariş</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatPrice(avgOrderValue)}</div>
                        <p className="text-xs text-gray-500">{all.count} sipariş (tüm zamanlar)</p>
                    </CardContent>
                </Card>
            </div>

            {/* Overall Stats */}
            <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                <CardContent className="py-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-blue-100 text-sm">Toplam Ciro</p>
                            <p className="text-4xl font-bold">{formatPrice(all.total)}</p>
                            {(stats.cancelled.count > 0 || stats.unpaid.count > 0) && (
                                <p className="text-blue-100 text-xs mt-1">
                                    Dahil değil:
                                    {stats.cancelled.count > 0 ? ` ${stats.cancelled.count} iptal (${formatPrice(stats.cancelled.total)})` : ""}
                                    {stats.cancelled.count > 0 && stats.unpaid.count > 0 ? "," : ""}
                                    {stats.unpaid.count > 0 ? ` ${stats.unpaid.count} ödeme bekleyen (${formatPrice(stats.unpaid.total)})` : ""}
                                </p>
                            )}
                        </div>
                        <DollarSign className="h-16 w-16 text-blue-200/50" />
                    </div>
                </CardContent>
            </Card>

            {/* Pazaryeri kırılımı */}
            <Card>
                <CardHeader>
                    <CardTitle>Pazaryeri Kırılımı</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-gray-800">
                                    <th className="py-2 pr-3 font-medium">Kaynak</th>
                                    {stats.periods.map((p) => (
                                        <th key={p.key} className="py-2 px-3 text-right font-medium">{p.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {stats.sourceRows.map((row) => (
                                    <tr key={row.src} className="border-b border-gray-100 dark:border-gray-800">
                                        <td className="py-2 pr-3 font-medium">{row.label}</td>
                                        {row.cells.map((c, i) => (
                                            <td key={i} className="py-2 px-3 text-right whitespace-nowrap">
                                                <div>{formatPrice(c.total)}</div>
                                                <div className="text-[11px] text-gray-500">{c.count} sipariş</div>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                                <tr className="font-semibold">
                                    <td className="py-2 pr-3">Toplam</td>
                                    {stats.periods.map((p) => (
                                        <td key={p.key} className="py-2 px-3 text-right whitespace-nowrap">
                                            <div>{formatPrice(stats.byKey[p.key].total)}</div>
                                            <div className="text-[11px] font-normal text-gray-500">{stats.byKey[p.key].count} sipariş</div>
                                        </td>
                                    ))}
                                </tr>
                            </tbody>
                        </table>
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
                            const percentage = maxDay > 0 ? (day.total / maxDay) * 100 : 0;
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
