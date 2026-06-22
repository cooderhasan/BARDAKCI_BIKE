import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { formatPrice, formatDate, getOrderStatusLabel, getOrderStatusColor } from "@/lib/helpers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Package, Truck, CreditCard, MapPin } from "lucide-react";
import { ReturnModal } from "@/components/orders/return-modal";
import { BankTransferForm } from "@/components/storefront/bank-transfer-form";
import { getSiteSettings } from "@/lib/settings";

interface OrderDetailPageProps {
    params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
    const { id } = await params;
    const session = await auth();

    if (!session?.user) {
        redirect(`/login?callbackUrl=/account/orders/${id}`);
    }

    const order = await prisma.order.findUnique({
        where: {
            id: id,
            userId: session.user.id,
        },
        include: {
            items: {
                include: {
                    returnRequest: true,
                    product: {
                        select: {
                            images: true,
                            slug: true,
                        }
                    }
                }
            },
            payment: true,
        },
    });

    if (!order) {
        notFound();
    }

    const isDelivered = order.status === "DELIVERED";
    const isBankTransfer = order.payment?.method === "BANK_TRANSFER";
    const isPaymentPending = order.payment?.status === "PENDING";

    // Banka bilgilerini çek
    let bankInfo: any = undefined;
    if (isBankTransfer) {
        const settings = await getSiteSettings();
        bankInfo = {
            bankName: settings.bankName || "",
            iban: settings.bankIban1 || "",
            accountHolder: settings.bankAccountName || "",
        };
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                        <Link href="/account/orders" className="hover:text-[#17457C] flex items-center gap-1 transition-colors">
                            <ArrowLeft className="w-4 h-4" />
                            Siparişlerim
                        </Link>
                        <span>/</span>
                        <span>Sipariş Detayı</span>
                    </div>
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        Sipariş #{order.orderNumber}
                        <Badge variant="outline" className={`${getOrderStatusColor(order.status)} border-0 text-sm px-3 py-1`}>
                            {getOrderStatusLabel(order.status)}
                        </Badge>
                    </h1>
                    <p className="text-gray-500 text-sm">
                        {formatDate(order.createdAt)} tarihinde oluşturuldu
                    </p>
                </div>
                {order.trackingUrl && (
                    <Button className="bg-[#17457C] hover:bg-[#0f3460] text-white" asChild>
                        <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer">
                            <Truck className="w-4 h-4 mr-2" />
                            Kargo Takip
                        </a>
                    </Button>
                )}
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Left Column: Order Items */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                            <h2 className="font-bold flex items-center gap-2">
                                <Package className="w-5 h-5 text-[#17457C]" />
                                Sipariş İçeriği
                            </h2>
                        </div>
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                            {order.items.map((item) => {
                                const returnRequest = item.returnRequest[0]; // Assuming one request per item for simplicity, or find active one
                                const canReturn = isDelivered && !returnRequest;

                                return (
                                    <div key={item.id} className="p-6 flex flex-col sm:flex-row gap-4 sm:items-center">
                                        <div className="relative w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden shrink-0 border border-gray-100 dark:border-gray-800">
                                            {item.product && item.product.images && item.product.images[0] ? (
                                                <Image
                                                    src={item.product.images[0]}
                                                    alt={item.productName}
                                                    fill
                                                    className="object-cover"
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-xs text-gray-400">
                                                    Resim Yok
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                                                {item.productName}
                                            </h3>
                                            <p className="text-sm text-gray-500 mt-1">
                                                {item.variantInfo || "Standart"}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                {item.quantity} Adet x {formatPrice(Number(item.unitPrice))}
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0 flex flex-col items-end gap-2">
                                            <span className="font-bold text-lg text-[#17457C]">
                                                {formatPrice(Number(item.lineTotal))}
                                            </span>

                                            {canReturn && (
                                                <ReturnModal
                                                    orderId={order.id}
                                                    orderItemId={item.id}
                                                    productName={item.productName}
                                                />
                                            )}

                                            {returnRequest && (
                                                <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400">
                                                    İade Talebi: {
                                                        returnRequest.status === "PENDING" ? "İnceleniyor" :
                                                            returnRequest.status === "APPROVED" ? "Onaylandı" :
                                                                returnRequest.status === "REJECTED" ? "Reddedildi" :
                                                                    returnRequest.status
                                                    }
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right Column: Order Summary & Details */}
                <div className="space-y-6">
                    {/* Payment Info */}
                    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
                        <h3 className="font-bold flex items-center gap-2 mb-4">
                            <CreditCard className="w-5 h-5 text-[#17457C]" />
                            Ödeme Bilgileri
                        </h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Ara Toplam</span>
                                <span className="font-medium">{formatPrice(Number(order.subtotal))}</span>
                            </div>
                            {Number(order.discountAmount) > 0 && (
                                <div className="flex justify-between text-green-600">
                                    <span>İndirim</span>
                                    <span>-{formatPrice(Number(order.discountAmount))}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-gray-500">KDV</span>
                                <span className="font-medium">{formatPrice(Number(order.vatAmount))}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Kargo</span>
                                <span className="font-medium">{Number(order.shippingCost) > 0 ? formatPrice(Number(order.shippingCost)) : "Ücretsiz"}</span>
                            </div>
                            <Separator className="my-2" />
                            <div className="flex justify-between text-lg font-bold">
                                <span>Toplam</span>
                                <span className="text-[#17457C]">{formatPrice(Number(order.total))}</span>
                            </div>
                            {order.payment && (
                                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                                    <p className="text-gray-500 mb-1">Ödeme Yöntemi</p>
                                    <p className="font-medium">
                                        {order.payment.method === "CREDIT_CARD" ? "Kredi Kartı" :
                                         order.payment.method === "CURRENT_ACCOUNT" ? "Cari Hesap" : "Havale / EFT"}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        Durum: {order.payment.status === "COMPLETED" ? "✅ Tamamlandı" :
                                                order.payment.status === "PENDING" ? "⏳ Bekliyor" : order.payment.status}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Havale Bildirim Formu */}
                    {isBankTransfer && isPaymentPending && (
                        <div className="bg-white dark:bg-gray-900 rounded-xl border border-green-200 dark:border-green-800 shadow-sm p-6">
                            <h3 className="font-bold flex items-center gap-2 mb-4 text-green-700 dark:text-green-400">
                                🏦 Havale Bildirimi
                            </h3>
                            <BankTransferForm
                                orderId={order.id}
                                orderTotal={Number(order.total)}
                                bankInfo={bankInfo}
                            />
                        </div>
                    )}

                    {/* Shipping Address */}
                    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
                        <h3 className="font-bold flex items-center gap-2 mb-4">
                            <MapPin className="w-5 h-5 text-[#17457C]" />
                            Teslimat Adresi
                        </h3>
                        <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                            {order.shippingAddress ? (
                                <>
                                    {/* Using type assertion or checking if it's an object with specific fields if possible. 
                                        For now, assume it's stored as JSON matching the address structure. 
                                    */}
                                    <p className="font-semibold text-gray-900 dark:text-white mb-1">
                                        {(order.shippingAddress as any).title || "Adres"}
                                    </p>
                                    <p>{(order.shippingAddress as any).address}</p>
                                    <p>
                                        {(order.shippingAddress as any).district} / {(order.shippingAddress as any).city}
                                    </p>
                                    <p className="mt-2 text-gray-900 dark:text-white font-medium">
                                        {(order.shippingAddress as any).phone}
                                    </p>
                                </>
                            ) : (
                                <p className="italic text-gray-400">Adres bilgisi bulunamadı.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
