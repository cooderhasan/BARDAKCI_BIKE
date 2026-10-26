import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { NON_REVENUE_STATUSES } from "@/lib/order-sources";
import type { OrderStatus } from "@prisma/client";

/**
 * Genel Bakış (admin ana sayfa) rakamları.
 * Ciro = müşterinin ödediği tutar (Order.total): KDV dahil, pazaryeri komisyonu düşülmemiş (kullanıcı kararı 2026-10-26).
 * İptal ve ödemesi tamamlanmamış siparişler hariç (Sipariş listesi özeti ve Satış Özeti ile aynı kural).
 * Gün/hafta/ay sınırları Türkiye saatine göre (sunucu UTC; Türkiye 2016'dan beri sabit UTC+3).
 * 60 sn önbellek: sayfa her açılışta yeniden hesaplamaz.
 */

const TR_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Türkiye saatine göre o günün 00:00'ı (UTC Date olarak) */
function trStartOfDay(d: Date): Date {
    const tr = new Date(d.getTime() + TR_OFFSET_MS);
    return new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate()) - TR_OFFSET_MS);
}
function trStartOfWeek(d: Date): Date {
    const start = trStartOfDay(d);
    const tr = new Date(start.getTime() + TR_OFFSET_MS);
    const dow = (tr.getUTCDay() + 6) % 7; // Pazartesi = 0
    return new Date(start.getTime() - dow * DAY_MS);
}
function trStartOfMonth(d: Date, monthOffset = 0): Date {
    const tr = new Date(d.getTime() + TR_OFFSET_MS);
    return new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth() + monthOffset, 1) - TR_OFFSET_MS);
}

const revenueWhere = { status: { notIn: [...NON_REVENUE_STATUSES] as OrderStatus[] } };

async function sumRange(from: Date, to: Date) {
    const agg = await prisma.order.aggregate({
        where: { ...revenueWhere, createdAt: { gte: from, lt: to } },
        _sum: { total: true },
        _count: { _all: true },
    });
    return { revenue: Number(agg._sum.total || 0), orders: agg._count._all };
}

export interface PeriodStat {
    revenue: number;
    orders: number;
    prevRevenue: number;
    prevOrders: number;
}

export interface DashboardData {
    today: PeriodStat;
    week: PeriodStat;
    month: PeriodStat;
    daily: { date: string; revenue: number; orders: number }[]; // son 30 gün, eskiden yeniye
    bySource: { source: string; revenue: number; orders: number }[]; // bu ay
    toShip: { source: string; count: number; late: number }[]; // Onaylandı + Hazırlanıyor
    toShipTotal: number;
    toShipLate: number;
    generatedAt: string;
}

async function loadDashboardData(): Promise<DashboardData> {
    const now = new Date();
    const today = trStartOfDay(now);
    const week = trStartOfWeek(now);
    const month = trStartOfMonth(now);
    const prevMonth = trStartOfMonth(now, -1);
    const elapsedMonth = now.getTime() - month.getTime();
    // Geçen ayın aynı günü/saatine kadar (geçen ay kısaysa ay sonunda kesilir)
    const prevMonthTo = new Date(Math.min(prevMonth.getTime() + elapsedMonth, month.getTime()));
    const from30 = new Date(today.getTime() - 29 * DAY_MS);
    const lateBefore = new Date(now.getTime() - 2 * DAY_MS); // 2 günden eski = gecikiyor

    const [t, tPrev, w, wPrev, m, mPrev, dailyRows, sourceRows, shipRows, lateRows] = await Promise.all([
        sumRange(today, now),
        sumRange(new Date(today.getTime() - DAY_MS), new Date(now.getTime() - DAY_MS)), // dün bu saate kadar
        sumRange(week, now),
        sumRange(new Date(week.getTime() - 7 * DAY_MS), new Date(now.getTime() - 7 * DAY_MS)),
        sumRange(month, now),
        sumRange(prevMonth, prevMonthTo),
        prisma.$queryRaw<{ d: string; revenue: number; orders: bigint }[]>`
            SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD') AS d,
                   COALESCE(SUM(total), 0)::float AS revenue,
                   COUNT(*) AS orders
            FROM orders
            WHERE "createdAt" >= ${from30} AND status NOT IN ('CANCELLED', 'WAITING_FOR_PAYMENT')
            GROUP BY d
        `,
        prisma.order.groupBy({
            by: ["source"],
            where: { ...revenueWhere, createdAt: { gte: month } },
            _sum: { total: true },
            _count: { _all: true },
        }),
        prisma.order.groupBy({
            by: ["source"],
            where: { status: { in: ["CONFIRMED", "PROCESSING"] as OrderStatus[] } },
            _count: { _all: true },
        }),
        prisma.order.groupBy({
            by: ["source"],
            where: { status: { in: ["CONFIRMED", "PROCESSING"] as OrderStatus[] }, createdAt: { lt: lateBefore } },
            _count: { _all: true },
        }),
    ]);

    // Son 30 gün: siparişsiz günler de 0 olarak gelsin
    const byDay = new Map(dailyRows.map((r) => [r.d, { revenue: Number(r.revenue), orders: Number(r.orders) }]));
    const daily = Array.from({ length: 30 }, (_, i) => {
        const dayStart = new Date(from30.getTime() + i * DAY_MS + TR_OFFSET_MS);
        const key = dayStart.toISOString().slice(0, 10);
        return { date: key, ...(byDay.get(key) || { revenue: 0, orders: 0 }) };
    });

    const lateBySource = new Map(lateRows.map((r) => [r.source || "WEB", r._count._all]));
    const toShip = shipRows
        .map((r) => ({ source: r.source || "WEB", count: r._count._all, late: lateBySource.get(r.source || "WEB") || 0 }))
        .sort((a, b) => b.count - a.count);

    return {
        today: { revenue: t.revenue, orders: t.orders, prevRevenue: tPrev.revenue, prevOrders: tPrev.orders },
        week: { revenue: w.revenue, orders: w.orders, prevRevenue: wPrev.revenue, prevOrders: wPrev.orders },
        month: { revenue: m.revenue, orders: m.orders, prevRevenue: mPrev.revenue, prevOrders: mPrev.orders },
        daily,
        bySource: sourceRows
            .map((r) => ({ source: r.source || "WEB", revenue: Number(r._sum.total || 0), orders: r._count._all }))
            .sort((a, b) => b.revenue - a.revenue),
        toShip,
        toShipTotal: toShip.reduce((a, b) => a + b.count, 0),
        toShipLate: toShip.reduce((a, b) => a + b.late, 0),
        generatedAt: now.toISOString(),
    };
}

export const getDashboardData = unstable_cache(loadDashboardData, ["admin-dashboard-v1"], { revalidate: 60, tags: ["admin-dashboard"] });
