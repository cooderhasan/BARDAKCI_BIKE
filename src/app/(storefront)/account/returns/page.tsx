import { auth } from "@/lib/auth";
import { getReturnRequests } from "@/app/actions/return";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatPrice } from "@/lib/helpers";

export default async function ReturnsPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login?callbackUrl=/account/returns");
    }

    const requests = await getReturnRequests();

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "PENDING":
                return "İnceleniyor";
            case "APPROVED":
                return "Onaylandı";
            case "REJECTED":
                return "Reddedildi";
            case "COMPLETED":
                return "Tamamlandı";
            case "CANCELLED":
                return "İptal Edildi";
            default:
                return status;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "PENDING":
                return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
            case "APPROVED":
                return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
            case "REJECTED":
                return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
            case "COMPLETED":
                return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-[#17457C]";
            case "CANCELLED":
                return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
            default:
                return "bg-gray-100 text-gray-700";
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold mb-2">İade Taleplerim</h1>
                    <p className="text-gray-500">Oluşturduğunuz iade taleplerinin durumunu buradan takip edebilirsiniz.</p>
                </div>
            </div>

            {requests.length === 0 ? (
                <div className="text-center py-16 border rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Henüz iade talebiniz yok</p>
                    <p className="text-gray-500 mb-6">İade talebi oluşturmak için ilgili siparişinizin detay sayfasına gidebilirsiniz.</p>
                    <Button asChild>
                        <Link href="/account/orders">Siparişlerim</Link>
                    </Button>
                </div>
            ) : (
                <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500">
                            <tr>
                                <th className="px-6 py-4">Talep No</th>
                                <th className="px-6 py-4">Tarih</th>
                                <th className="px-6 py-4">Ürün</th>
                                <th className="px-6 py-4">Sipariş No</th>
                                <th className="px-6 py-4">Durum</th>
                                <th className="px-6 py-4 text-right">Tutar</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y text-gray-700 dark:text-gray-300">
                            {requests.map((request) => (
                                <tr key={request.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                                        #{request.id.slice(-8).toUpperCase()}
                                    </td>
                                    <td className="px-6 py-4">
                                        {formatDate(request.createdAt)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900 dark:text-white">
                                            {request.orderItem.productName}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {request.orderItem.quantity} Adet
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Link href={`/account/orders/${request.orderId}`} className="text-[#17457C] hover:underline">
                                            #{request.order.orderNumber}
                                        </Link>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge variant="secondary" className={`${getStatusColor(request.status)} border-0`}>
                                            {getStatusLabel(request.status)}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium">
                                        {formatPrice(Number(request.orderItem.unitPrice) * request.orderItem.quantity)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
