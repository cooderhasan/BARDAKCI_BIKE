import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/helpers";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Building2, Package, MapPin, AlertTriangle, Truck, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BankTransferForm } from "@/components/storefront/bank-transfer-form";

interface OrderPageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function OrderPage({ params }: OrderPageProps) {
    const { id } = await params;
    const session = await auth();

    // if (!session?.user) {
    //    redirect("/login");
    // }

    // First fetch the order without user constraint to check if it exists and who it belongs to
    const order = await prisma.order.findUnique({
        where: {
            id: id,
        },
        include: {
            items: true,
            payment: true,
        },
    });

    if (!order) {
        notFound();
    }

    // Security check:
    // 1. If order has a userId, ONLY that user can view it.
    // 2. If order has NO userId (guest order), ANYONE with the link can view it (assuming UUID security).
    if (order.userId) {
        if (!session?.user || session.user.id !== order.userId) {
            // If user is not logged in, or logged in as wrong user -> Redirect to login or 403
            // For better UX, redirect to login might be better, or just 404 to hide existence
            if (!session?.user) {
                redirect(`/login?callbackUrl=/orders/${id}`);
            } else {
                notFound(); // Hide order from wrong signed-in user
            }
        }
    }

    const generalSettings = await prisma.siteSettings.findUnique({
        where: { key: "general" },
    });


    const settings = (generalSettings?.value as Record<string, string>) || {};
    const isBankTransfer = order.payment?.method === "BANK_TRANSFER";

    // Detect if buyer pays (Alıcı Ödemeli)
    const cargoCompanyDetails = order.cargoCompany
        ? await prisma.cargoCompany.findFirst({ where: { name: order.cargoCompany } })
        : null;

    const isBuyerPays = Number((order as any).shippingCost || 0) === 0 && cargoCompanyDetails && !(cargoCompanyDetails as any).isDesiActive;

    return (
        <div className="container mx-auto px-4 py-12">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Success Message */}
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        Siparişiniz Alındı!
                    </h1>
                    <p className="text-gray-500">
                        Sipariş numaranız: <span className="font-bold text-gray-900 dark:text-gray-100">#{order.orderNumber}</span>
                    </p>
                </div>

                <div className="grid gap-8 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-6">
                        {/* Order Details */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Package className="h-5 w-5" />
                                    Sipariş Detayları
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-4">
                                    {order.items.map((item) => (
                                        <div key={item.id} className="flex justify-between items-start py-2 border-b last:border-0 border-gray-100 dark:border-gray-800">
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">
                                                    {item.productName}
                                                </p>
                                                <p className="text-sm text-gray-500">
                                                    {item.quantity} adet x{" "}
                                                    {Number(item.lineTotal) / item.quantity < Number(item.unitPrice) && (
                                                        <span className="line-through text-gray-400 mr-1">
                                                            {formatPrice(Number(item.unitPrice))}
                                                        </span>
                                                    )}
                                                    {formatPrice(Number(item.lineTotal) / item.quantity)}
                                                </p>
                                            </div>
                                            <p className="font-medium text-gray-900 dark:text-white">
                                                {formatPrice(Number(item.lineTotal))}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-2 pt-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Ara Toplam</span>
                                        <span className="font-medium">{formatPrice(Number(order.subtotal))}</span>
                                    </div>
                                    {Number(order.discountAmount) > 0 && (
                                        <div className="flex justify-between text-sm text-green-600">
                                            <span>İskonto</span>
                                            <span>-{formatPrice(Number(order.discountAmount))}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">KDV Tutarı</span>
                                        <span className="font-medium">{formatPrice(Number(order.vatAmount))}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Kargo Ücreti</span>
                                        <span className="font-medium">
                                            {isBuyerPays ? (
                                                <span className="text-[#17457C] font-bold uppercase text-[10px]">Alıcı Ödemeli</span>
                                            ) : Number((order as any).shippingCost || 0) === 0 ? (
                                                <span className="text-green-600 font-medium">Ücretsiz</span>
                                            ) : (
                                                formatPrice(Number((order as any).shippingCost || 0))
                                            )}
                                        </span>
                                    </div>
                                    <Separator className="my-2" />
                                    <div className="flex justify-between text-lg font-bold">
                                        <span>Genel Toplam</span>
                                        <span className="text-[#17457C]">{formatPrice(Number(order.total))}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Bank Payment Info - Only show for bank transfer */}
                        {isBankTransfer && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Building2 className="h-5 w-5" />
                                        Banka Hesap Bilgileri
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* 3 Day Payment Warning */}
                                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                                        <div className="flex items-start gap-3">
                                            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <p className="font-semibold text-red-800 dark:text-red-200">
                                                    Önemli Uyarı
                                                </p>
                                                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                                                    Ödemenizi <strong>3 gün içinde</strong> yapmanız gerekmektedir.
                                                    Aksi takdirde siparişiniz <strong>sevk edilmeyecektir</strong>.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {(settings.bankIban1 || settings.bankIban2) ? (
                                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                            <p className="text-sm text-blue-800 dark:text-blue-200 mb-4">
                                                Lütfen ödeme yaparken sipariş numaranızı (<strong>#{order.orderNumber}</strong>) açıklama kısmına yazınız.
                                            </p>
                                            <div className="space-y-3">
                                                {settings.bankName && (
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase font-semibold">Banka Adı</p>
                                                        <p className="font-medium">{settings.bankName}</p>
                                                    </div>
                                                )}
                                                {settings.bankAccountName && (
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase font-semibold">Alıcı Adı</p>
                                                        <p className="font-medium">{settings.bankAccountName}</p>
                                                    </div>
                                                )}
                                                {settings.bankIban1 && (
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase font-semibold">IBAN</p>
                                                        <p className="font-mono font-medium text-lg">{settings.bankIban1}</p>
                                                    </div>
                                                )}
                                                {settings.bankIban2 && (
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase font-semibold">Alternatif IBAN</p>
                                                        <p className="font-mono font-medium text-lg">{settings.bankIban2}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                                            <p className="text-sm text-amber-800 dark:text-amber-200">
                                                Banka hesap bilgileri için lütfen bizimle iletişime geçin.
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Havale Bildirim Formu */}
                        {isBankTransfer && order.payment?.status === "PENDING" && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-green-700">
                                        💳 Havale Bildirimi
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <BankTransferForm
                                        orderId={order.id}
                                        orderTotal={Number(order.total)}
                                    />
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    <div className="space-y-6">
                        {/* Shipping Address */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <MapPin className="h-5 w-5" />
                                    Teslimat Bilgileri
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="text-sm space-y-2">
                                    {order.shippingAddress && typeof order.shippingAddress === 'object' && (
                                        <>
                                            <p className="font-semibold">{(order.shippingAddress as any).name}</p>
                                            <p>{(order.shippingAddress as any).address}</p>
                                            <p>
                                                {(order.shippingAddress as any).district} / {(order.shippingAddress as any).city}
                                            </p>
                                            <p className="mt-2 text-gray-500">{(order.shippingAddress as any).phone}</p>
                                        </>
                                    )}
                                </div>

                                <Separator />

                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold flex items-center gap-2">
                                        <Truck className="h-4 w-4" />
                                        Kargo Bilgileri
                                    </h4>
                                    <p className="text-sm">
                                        <span className="text-gray-500">Firma:</span>{" "}
                                        <span className="font-medium">{order.cargoCompany || "Belirtilmemiş"}</span>
                                    </p>
                                    {order.trackingUrl && (
                                        <div className="pt-2">
                                            <a
                                                href={order.trackingUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 w-full justify-center p-2 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md transition-colors"
                                            >
                                                Kargo Takip
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Actions */}
                        <div className="flex flex-col gap-3">
                            <Link href="/products" className="w-full">
                                <Button className="w-full">Alışverişe Devam Et</Button>
                            </Link>
                            <Link href="/" className="w-full">
                                <Button variant="outline" className="w-full">Anasayfaya Dön</Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
