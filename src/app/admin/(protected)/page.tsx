import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Package,
    Users,
    ShoppingCart,
    TrendingUp,
    Clock,
    CheckCircle,
    AlertTriangle,
} from "lucide-react";
import { formatPrice, getOrderStatusLabel, getOrderStatusColor } from "@/lib/helpers";
import Link from "next/link";

async function getDashboardStats() {
    const [
        totalProducts,
        totalDealers,
        pendingDealers,
        totalOrders,
        pendingOrders,
        recentOrders,
        lowStockProducts,
    ] = await Promise.all([
        prisma.product.count({ where: { isActive: true } }),
        prisma.user.count({ where: { role: "DEALER", status: "APPROVED" } }),
        prisma.user.count({ where: { status: "PENDING" } }),
        prisma.order.count(),
        prisma.order.count({ where: { status: "PENDING" } }),
        prisma.order.findMany({
            take: 5,
            orderBy: { createdAt: "desc" },
            include: {
                user: { select: { companyName: true, email: true } },
                payment: { select: { method: true } },
            },
        }),
        // Düşük stoklu ürünleri bul
        prisma.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(*) as count FROM products 
            WHERE "isActive" = true AND stock <= "criticalStock"
        `,
    ]);

    // Revenue calculation
    const completedOrders = await prisma.order.findMany({
        where: { status: { in: ["DELIVERED", "SHIPPED"] } },
        select: { total: true },
    });
    const totalRevenue = completedOrders.reduce(
        (sum, order) => sum + Number(order.total),
        0
    );

    return {
        totalProducts,
        totalDealers,
        pendingDealers,
        totalOrders,
        pendingOrders,
        lowStockCount: Number(lowStockProducts[0]?.count || 0),
        totalRevenue: Number(totalRevenue),
        recentOrders: recentOrders.map((order) => ({
            ...order,
            subtotal: Number(order.subtotal),
            discountAmount: Number(order.discountAmount),
            vatAmount: Number(order.vatAmount),
            total: Number(order.total),
            appliedDiscountRate: Number(order.appliedDiscountRate),
            items: [], // We don't need items for the dashboard summary
            payment: null, // We don't need payment details for the summary
        })),
    };
}

export default async function AdminDashboardPage() {
    const stats = await getDashboardStats();

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Dashboard
                </h2>
                <p className="text-gray-500 dark:text-gray-400">
                    Hoş geldiniz! İşte güncel özet bilgiler.
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Toplam Ciro
                        </CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatPrice(stats.totalRevenue)}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Toplam Sipariş
                        </CardTitle>
                        <ShoppingCart className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalOrders}</div>
                        <p className="text-xs text-amber-600">
                            {stats.pendingOrders} beklemede
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Aktif Bayiler
                        </CardTitle>
                        <Users className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalDealers}</div>
                        {stats.pendingDealers > 0 && (
                            <p className="text-xs text-amber-600">
                                {stats.pendingDealers} onay bekliyor
                            </p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Aktif Ürünler
                        </CardTitle>
                        <Package className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalProducts}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Pending Dealers Alert */}
            {stats.pendingDealers > 0 && (
                <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
                    <CardContent className="flex items-center justify-between py-4">
                        <div className="flex items-center gap-3">
                            <Clock className="h-5 w-5 text-amber-600" />
                            <div>
                                <p className="font-medium text-amber-800 dark:text-amber-200">
                                    {stats.pendingDealers} bayi onay bekliyor
                                </p>
                                <p className="text-sm text-amber-600 dark:text-amber-400">
                                    Müşteri yönetiminden onaylayabilirsiniz.
                                </p>
                            </div>
                        </div>
                        <Link
                            href="/admin/customers?status=PENDING"
                            className="text-sm font-medium text-amber-700 hover:text-amber-800 dark:text-amber-300"
                        >
                            Görüntüle →
                        </Link>
                    </CardContent>
                </Card>
            )}

            {/* Low Stock Alert */}
            {stats.lowStockCount > 0 && (
                <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                    <CardContent className="flex items-center justify-between py-4">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                            <div>
                                <p className="font-medium text-red-800 dark:text-red-200">
                                    {stats.lowStockCount} üründe stok kritik seviyede!
                                </p>
                                <p className="text-sm text-red-600 dark:text-red-400">
                                    Stok yönetimi için hemen kontrol edin.
                                </p>
                            </div>
                        </div>
                        <Link
                            href="/admin/stock-alerts"
                            className="text-sm font-medium text-red-700 hover:text-red-800 dark:text-red-300"
                        >
                            Görüntüle →
                        </Link>
                    </CardContent>
                </Card>
            )}

            {/* Recent Orders */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Son Siparişler</CardTitle>
                    <Link
                        href="/admin/orders"
                        className="text-sm text-[#17457C] hover:text-blue-700"
                    >
                        Tümünü Gör →
                    </Link>
                </CardHeader>
                <CardContent>
                    {stats.recentOrders.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">
                            Henüz sipariş bulunmuyor.
                        </p>
                    ) : (
                        <div className="space-y-4">
                            {stats.recentOrders.map((order) => (
                                <Link
                                    href={`/admin/orders`}
                                    key={order.id}
                                    className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4 last:border-0 last:pb-0 hover:bg-gray-50 dark:hover:bg-gray-900/50 p-2 rounded-lg transition-colors cursor-pointer group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                                            <ShoppingCart className="h-5 w-5 text-gray-500 group-hover:text-[#17457C] dark:group-hover:text-blue-400" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white group-hover:text-[#17457C] transition-colors">
                                                {order.orderNumber}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                {order.user?.companyName || order.user?.email || (order as any).guestEmail || "Misafir"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-medium text-gray-900 dark:text-white">
                                            {formatPrice(Number(order.total))}
                                        </p>
                                        <div className="flex flex-col items-end gap-1">
                                            <Badge
                                                variant="secondary"
                                                className={getOrderStatusColor(order.status)}
                                            >
                                                {getOrderStatusLabel(order.status, (order as any).payment?.method)}
                                            </Badge>
                                            <span className="text-[10px] text-gray-500 font-medium whitespace-nowrap">
                                                {(order as any).payment?.method === "BANK_TRANSFER" ? "Havale / EFT" : "Kredi Kartı"}
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
