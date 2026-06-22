import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatPrice, formatDate, getOrderStatusLabel, getOrderStatusColor } from "@/lib/helpers";
import { Package, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

async function getAccountStats(userId: string) {
    const totalOrders = await prisma.order.count({
        where: { userId },
    });

    const activeOrders = await prisma.order.count({
        where: {
            userId,
            status: {
                in: ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED"],
            },
        },
    });

    const recentOrders = await prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 3,
        include: {
            items: true,
        },
    });

    return { totalOrders, activeOrders, recentOrders };
}

export default async function AccountPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login?callbackUrl=/account");
    }

    const { totalOrders, activeOrders, recentOrders } = await getAccountStats(session.user.id);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold mb-2">Genel Bakış</h1>
                <p className="text-gray-500">
                    Merhaba <span className="font-semibold text-gray-900 dark:text-gray-100">{session.user.name || session.user.email}</span>, hesabına hoş geldin.
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex items-center gap-4">
                    <div className="bg-blue-100 dark:bg-blue-800 p-3 rounded-full">
                        <Package className="h-6 w-6 text-[#17457C] dark:text-blue-200" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Toplam Sipariş</p>
                        <p className="text-xl font-bold">{totalOrders}</p>
                    </div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg flex items-center gap-4">
                    <div className="bg-purple-100 dark:bg-purple-800 p-3 rounded-full">
                        <Clock className="h-6 w-6 text-purple-600 dark:text-purple-200" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Aktif Siparişler</p>
                        <p className="text-xl font-bold">{activeOrders}</p>
                    </div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg flex items-center gap-4">
                    <div className="bg-green-100 dark:bg-green-800 p-3 rounded-full">
                        <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-200" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Tamamlanan</p>
                        <p className="text-xl font-bold">{totalOrders - activeOrders}</p>
                    </div>
                </div>
            </div>

            {/* Recent Orders */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Son Siparişler</h2>
                    <Button variant="link" asChild>
                        <Link href="/account/orders">Tümünü Gör</Link>
                    </Button>
                </div>

                {recentOrders.length === 0 ? (
                    <div className="text-center py-12 border rounded-lg bg-gray-50 dark:bg-gray-800/50">
                        <p className="text-gray-500 mb-4">Henüz hiç siparişiniz bulunmuyor.</p>
                        <Button asChild>
                            <Link href="/products">Alışverişe Başla</Link>
                        </Button>
                    </div>
                ) : (
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500">
                                <tr>
                                    <th className="px-4 py-3">Sipariş No</th>
                                    <th className="px-4 py-3">Tarih</th>
                                    <th className="px-4 py-3">Durum</th>
                                    <th className="px-4 py-3 text-right">Tutar</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {recentOrders.map((order) => (
                                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                        <td className="px-4 py-3 font-medium">#{order.orderNumber}</td>
                                        <td className="px-4 py-3 text-gray-500">{formatDate(order.createdAt)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getOrderStatusColor(order.status)}`}>
                                                {getOrderStatusLabel(order.status)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium">{formatPrice(Number(order.total))}</td>
                                        <td className="px-4 py-3 text-right">
                                            <Button variant="ghost" size="sm" asChild>
                                                <Link href={`/orders/${order.id}`}>Detay</Link>
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
