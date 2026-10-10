"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

async function requireAdmin() {
    const session = await auth();
    return !!session?.user && (session.user.role === "ADMIN" || session.user.role === "OPERATOR");
}

type NotificationRow = { id: string; productId: string; productName: string; email: string; variantLabel: string | null; createdAt: string; notifiedAt: string | null };

/** "Gelince Haber Ver" talepleri: en çok beklenen ürünler (hangi ürünü önce tedarik etmeli) ve tek tek talepler */
export async function getStockNotificationSummary(): Promise<{
    pendingTotal: number;
    sentLast30Days: number;
    products: { productId: string; name: string; sku: string | null; stock: number; waiting: number }[];
    pendingList: NotificationRow[];
    sentList: NotificationRow[];
}> {
    if (!(await requireAdmin())) return { pendingTotal: 0, sentLast30Days: 0, products: [], pendingList: [], sentList: [] };

    // Tek tek talepler: kim, hangi ürün/seçenek, ne zaman (bekleyen + son gönderilen)
    const rowSelect = {
        id: true, productId: true, email: true, variantId: true, createdAt: true, notifiedAt: true,
        product: { select: { name: true, variants: { select: { id: true, color: true, size: true } } } },
    } as const;
    const toRow = (n: any): NotificationRow => {
        const v = n.variantId ? n.product?.variants?.find((x: any) => x.id === n.variantId) : null;
        return {
            id: n.id,
            productId: n.productId,
            productName: n.product?.name || "-",
            email: n.email,
            variantLabel: v ? [v.color, v.size].filter(Boolean).join(" / ") || null : null,
            createdAt: n.createdAt.toISOString(),
            notifiedAt: n.notifiedAt ? n.notifiedAt.toISOString() : null,
        };
    };
    const [pendingRows, sentRows] = await Promise.all([
        prisma.stockNotification.findMany({ where: { notifiedAt: null }, orderBy: { createdAt: "desc" }, take: 100, select: rowSelect }),
        prisma.stockNotification.findMany({ where: { notifiedAt: { not: null } }, orderBy: { notifiedAt: "desc" }, take: 50, select: rowSelect }),
    ]);

    const [grouped, pendingTotal, sentLast30Days] = await Promise.all([
        prisma.stockNotification.groupBy({
            by: ["productId"],
            where: { notifiedAt: null },
            _count: { _all: true },
            orderBy: { _count: { productId: "desc" } },
            take: 50,
        }),
        prisma.stockNotification.count({ where: { notifiedAt: null } }),
        prisma.stockNotification.count({ where: { notifiedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
    ]);

    const products = await prisma.product.findMany({
        where: { id: { in: grouped.map((g) => g.productId) } },
        select: { id: true, name: true, sku: true, stock: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    return {
        pendingTotal,
        sentLast30Days,
        pendingList: pendingRows.map(toRow),
        sentList: sentRows.map(toRow),
        products: grouped
            .map((g) => {
                const p = byId.get(g.productId);
                return p ? { productId: p.id, name: p.name, sku: p.sku, stock: p.stock, waiting: g._count._all } : null;
            })
            .filter(Boolean) as { productId: string; name: string; sku: string | null; stock: number; waiting: number }[],
    };
}

/** Günlük gönderimi beklemeden şimdi gönder (günlük sınır yine geçerli) */
export async function sendStockNotificationsNow(): Promise<{ success: boolean; message: string }> {
    if (!(await requireAdmin())) return { success: false, message: "Yetkisiz işlem." };
    const { processStockNotifications } = await import("@/lib/stock-notifications");
    const res = await processStockNotifications();
    return { success: true, message: res.message };
}
