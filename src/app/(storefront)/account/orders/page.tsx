import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatPrice, formatDate, getOrderStatusLabel, getOrderStatusColor } from "@/lib/helpers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AccountOrderCards } from "@/components/storefront/account-order-cards";

export default async function OrdersPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login?callbackUrl=/account/orders");
    }

    const orders = await prisma.order.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        include: {
            items: true,
        },
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div>
                    <h1 className="text-2xl font-bold mb-2">Siparişlerim</h1>
                    <p className="text-gray-500">Geçmiş siparişlerinizi buradan görüntüleyebilirsiniz.</p>
                </div>
                <Button asChild>
                    <Link href="/">Yeni Sipariş Ver</Link>
                </Button>
            </div>

            {orders.length === 0 ? (
                <div className="text-center py-16 border rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Henüz siparişiniz yok</p>
                    <p className="text-gray-500 mb-6">İhtiyacınız olan ürünleri bulmak için kataloğumuza göz atın.</p>
                    <Button asChild>
                        <Link href="/products">Alışverişe Başla</Link>
                    </Button>
                </div>
            ) : (
                <>
                <AccountOrderCards orders={orders} hrefBase="/account/orders" />
                <div className="hidden md:block border rounded-lg overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500">
                            <tr>
                                <th className="px-6 py-4">Sipariş No</th>
                                <th className="px-6 py-4">Tarih</th>
                                <th className="px-6 py-4">Ürün Sayısı</th>
                                <th className="px-6 py-4">Durum</th>
                                <th className="px-6 py-4 text-right">Toplam Tutar</th>
                                <th className="px-6 py-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y text-gray-700 dark:text-gray-300">
                            {orders.map((order) => (
                                <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                                        #{order.orderNumber}
                                    </td>
                                    <td className="px-6 py-4">
                                        {formatDate(order.createdAt)}
                                    </td>
                                    <td className="px-6 py-4">
                                        {order.items.length} Ürün
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge variant="outline" className={`${getOrderStatusColor(order.status)} border-0`}>
                                            {getOrderStatusLabel(order.status)}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-gray-100">
                                        {formatPrice(Number(order.total))}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Button variant="ghost" size="sm" asChild>
                                            <Link href={`/account/orders/${order.id}`}>Detay</Link>
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                </>
            )}
        </div>
    );
}
