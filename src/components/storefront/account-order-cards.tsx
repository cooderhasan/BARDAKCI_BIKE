import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatPrice, formatDate, getOrderStatusLabel, getOrderStatusColor } from "@/lib/helpers";

type OrderRow = {
    id: string;
    orderNumber: string;
    createdAt: Date;
    status: string;
    total: unknown;
    items: unknown[];
};

/**
 * Hesabım'da telefon görünümü: sipariş tablosu yerine kartlar (md altı).
 * Tablo telefona sığmıyordu; kutunun overflow-hidden'ı yüzünden Durum/Tutar/Detay sütunları kesiliyordu.
 */
export function AccountOrderCards({ orders, hrefBase }: { orders: OrderRow[]; hrefBase: string }) {
    return (
        <div className="md:hidden space-y-2.5">
            {orders.map((order) => (
                <Link
                    key={order.id}
                    href={`${hrefBase}/${order.id}`}
                    className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 active:bg-gray-50 dark:active:bg-gray-800"
                >
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">#{order.orderNumber}</span>
                            <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${getOrderStatusColor(order.status as any)}`}>
                                {getOrderStatusLabel(order.status as any)}
                            </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-gray-500">
                            <span className="truncate">
                                {formatDate(order.createdAt)} · {order.items.length} ürün
                            </span>
                            <span className="shrink-0 text-sm font-bold text-gray-900 dark:text-gray-100">{formatPrice(Number(order.total))}</span>
                        </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                </Link>
            ))}
        </div>
    );
}
