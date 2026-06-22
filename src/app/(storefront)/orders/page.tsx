import { getCustomerOrders } from "@/app/(storefront)/orders/actions";
import { formatDate, formatPrice, getOrderStatusLabel, getOrderStatusColor } from "@/lib/helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReorderButton } from "@/components/storefront/reorder-button";
import { PackageOpen } from "lucide-react";
import Link from "next/link";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

export default async function OrdersPage() {
    const orders = await getCustomerOrders();

    if (orders.length === 0) {
        return (
            <div className="container mx-auto px-4 py-16 text-center">
                <div className="flex justify-center mb-6">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                        <PackageOpen className="w-10 h-10" />
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Henüz Siparişiniz Yok</h1>
                <p className="text-gray-500 mb-8">Sipariş verdiğinizde burada listelenecektir.</p>
                <Link href="/products">
                    <Button>Alışverişe Başla</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-12">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Siparişlerim</h1>

            <div className="space-y-6">
                {orders.map((order) => (
                    <Card key={order.id} className="overflow-hidden">
                        <CardHeader className="bg-gray-50 dark:bg-gray-800/50 p-4 sm:p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold text-lg text-gray-900 dark:text-white">
                                            #{order.orderNumber}
                                        </span>
                                        <Badge className={getOrderStatusColor(order.status)}>
                                            {getOrderStatusLabel(order.status)}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-gray-500">
                                        {formatDate(order.createdAt)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-sm text-gray-500">Toplam Tutar</p>
                                        <p className="font-bold text-gray-900 dark:text-white">
                                            {formatPrice(order.total)}
                                        </p>
                                    </div>
                                    <ReorderButton orderId={order.id} />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Accordion type="single" collapsible>
                                <AccordionItem value="details" className="border-b-0">
                                    <AccordionTrigger className="px-4 sm:px-6 hover:no-underline">
                                        <span className="text-sm font-medium text-[#17457C] hover:text-blue-700">
                                            Sipariş Detaylarını Göster ({order.items.length} Ürün)
                                        </span>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="px-4 sm:px-6 pb-6">
                                            <div className="border rounded-lg overflow-hidden">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500">
                                                        <tr>
                                                            <th className="p-3 font-medium">Ürün</th>
                                                            <th className="p-3 font-medium text-center">Adet</th>
                                                            <th className="p-3 font-medium text-right">Birim Fiyat</th>
                                                            <th className="p-3 font-medium text-right">Toplam</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y dark:divide-gray-700">
                                                        {order.items.map((item) => (
                                                            <tr key={item.id} className="bg-white dark:bg-gray-900/50">
                                                                <td className="p-3 font-medium text-gray-900 dark:text-white">
                                                                    {item.productName}
                                                                </td>
                                                                <td className="p-3 text-center">{item.quantity}</td>
                                                                <td className="p-3 text-right text-gray-500">
                                                                    {formatPrice(item.unitPrice)}
                                                                </td>
                                                                <td className="p-3 text-right font-medium text-gray-900 dark:text-white">
                                                                    {formatPrice(item.lineTotal)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Mobile Summary (Visible mostly on small screens if we hide header summary) */}
                                            <div className="mt-4 sm:hidden flex justify-between items-center border-t pt-4">
                                                <span className="font-bold">Genel Toplam</span>
                                                <span className="font-bold text-lg">{formatPrice(order.total)}</span>
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
