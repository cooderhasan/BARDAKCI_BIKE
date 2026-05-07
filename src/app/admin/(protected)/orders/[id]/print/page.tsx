import { prisma } from "@/lib/db";
import { formatPrice, formatDate } from "@/lib/helpers";
import { getSiteSettings } from "@/lib/settings";
import { notFound } from "next/navigation";
import Image from "next/image";
import { PrintButton } from "@/components/admin/print-button";
import { AutoPrint } from "@/components/admin/auto-print";
import { Barcode } from "@/components/admin/barcode";

// Helper to serialise decimals safely
const toNumber = (value: any) => {
    if (value === null || value === undefined) return 0;
    return typeof value === "object" && "toNumber" in value ? value.toNumber() : Number(value);
};

export default async function OrderPrintPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const order = await prisma.order.findUnique({
        where: { id },
        include: {
            user: true,
            items: {
                include: {
                    product: true,
                    variant: true,
                }
            },
            payment: true,
        },
    });

    if (!order) {
        notFound();
    }

    const settings = await getSiteSettings();

    // Prepare shipping address
    // Assuming shippingAddress is stored as JSON with standard fields
    const shippingAddress = order.shippingAddress as any; // Type assertion for now

    return (
        <div className="bg-white min-h-screen text-black p-8 max-w-[210mm] mx-auto">
            {/* Print CSS to hide non-print elements */}
            <style>{`
                @media print {
                    @page { margin: 0.5cm; }
                    body { -webkit-print-color-adjust: exact; background-color: white !important; }
                    .no-print, header, aside { display: none !important; }
                    /* Reset layout padding from admin layout */
                    .lg\\:pl-64 { padding-left: 0 !important; }
                    /* Ensure main content takes full width */
                    main { padding: 0 !important; margin: 0 !important; width: 100% !important; max-width: none !important; }
                }
            `}</style>


            {/* Auto-print component */}
            <AutoPrint />

            {/* Actions (Hidden in Print) */}
            <div className="no-print mb-8 flex justify-between items-center bg-gray-100 p-4 rounded-lg">
                <div className="flex flex-col">
                    <span className="text-gray-600 font-medium">Baskı Önizleme</span>
                    <span className="text-xs text-gray-500">Bu sayfa otomatik olarak yazıcı diyaloğunu açar.</span>
                </div>
                <PrintButton />
            </div>

            {/* Invoice Header / Trendyol Style Header */}
            {order.source === "TRENDYOL" ? (
                <div className="space-y-6 mb-8">
                    {/* Warning Box */}
                    <div className="border border-gray-400 p-3 rounded-sm flex items-center gap-3 text-sm font-bold">
                        <span className="text-xl">⚠️</span>
                        <p>Kargo şirketinin dikkatine, bu bir trendyol.com gönderisidir. Trendyol anlaşmasına uygun işlem yapabilirsiniz.</p>
                    </div>

                    {/* Logo Section */}
                    <div className="flex justify-between items-center">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Trendyol_logo.svg/1200px-Trendyol_logo.svg.png" alt="Trendyol" className="h-14 w-auto" />
                        <div className="text-right">
                            <span className="text-lg font-bold italic text-gray-700">trendyol</span>
                            <span className="text-sm font-medium block text-gray-500 uppercase -mt-1">express</span>
                        </div>
                    </div>

                    {/* Info & Barcode Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Address Box */}
                        <div className="border-2 border-gray-300 rounded-lg p-5 space-y-4">
                            <h3 className="text-lg font-black text-blue-900 border-b-2 border-gray-100 pb-1 mb-3 uppercase">Alıcı Bilgileri</h3>
                            <div className="grid grid-cols-[80px_1fr] gap-y-2 text-sm">
                                <span className="font-bold">Sipariş No</span>
                                <span className="font-medium">: {order.orderNumber}</span>
                                
                                <span className="font-bold">Ad-Soyad</span>
                                <span className="font-medium uppercase">: {shippingAddress?.fullName || shippingAddress?.name}</span>
                                
                                <span className="font-bold">Adres</span>
                                <div className="font-medium">
                                    : {shippingAddress?.address}
                                    <div className="font-bold mt-1 uppercase">{shippingAddress?.district} / {shippingAddress?.city}</div>
                                </div>
                                
                                <span className="font-bold">Çıkış Şubesi</span>
                                <span className="font-medium">: Kanyon Şube</span>
                            </div>
                        </div>

                        {/* Barcode Box */}
                        <div className="border-2 border-gray-300 rounded-lg p-5 flex flex-col items-center justify-center">
                            <h3 className="text-lg font-black text-blue-900 w-full mb-4 uppercase">Kargo Barkodu</h3>
                            <Barcode 
                                value={order.cargoTrackingNumber || order.orderNumber} 
                                width={2.5} 
                                height={120} 
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex justify-between items-start border-b border-gray-300 pb-8 mb-8">
                    <div className="space-y-2">
                        {settings.logoUrl && (
                            <div className="mb-4">
                                <img src={settings.logoUrl} alt="Logo" className="h-16 w-auto object-contain" />
                            </div>
                        )}
                        <h1 className="text-2xl font-bold">{settings.companyName || "Firma Adı"}</h1>
                        <div className="text-sm text-gray-600 whitespace-pre-wrap">
                            {settings.address}
                            <br />
                            {settings.phone} | {settings.email}
                        </div>
                    </div>
                    <div className="text-right space-y-2">
                        <h2 className="text-3xl font-bold text-gray-800">SİPARİŞ BİLGİ FİŞİ</h2>
                        <p className="text-lg font-semibold">#{order.orderNumber}</p>
                        <p className="text-gray-600">{formatDate(order.createdAt)}</p>
                    </div>
                </div>
            )}

            {/* Standard Header (Customer & Shipping) - Hidden if Trendyol source (already shown above) */}
            {order.source !== "TRENDYOL" && (
                <div className="grid grid-cols-2 gap-12 mb-8">
                    <div>
                        <h3 className="text-gray-500 font-semibold mb-2 uppercase tracking-wider text-sm">Müşteri Bilgileri</h3>
                        <div className="text-gray-800">
                            <p className="font-bold text-lg">
                                {shippingAddress?.fullName || shippingAddress?.name || order.user?.name || order.user?.companyName || order.user?.email || (order as any).guestEmail || "Misafir"}
                            </p>
                            <p>{order.user?.email || (order as any).guestEmail}</p>
                            <p>{order.user?.phone || "-"}</p>
                            <p className="mt-2 whitespace-pre-wrap">{order.user?.address}</p>
                            <p>{order.user?.district} {order.user?.district && '/'} {order.user?.city}</p>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-gray-500 font-semibold mb-2 uppercase tracking-wider text-sm">Teslimat Adresi</h3>
                        <div className="text-gray-800">
                            {shippingAddress ? (
                                <>
                                    <p className="font-bold">{shippingAddress.title || "Adres"}</p>
                                    <p className="whitespace-pre-wrap">{shippingAddress.address}</p>
                                    <p>{shippingAddress.district} / {shippingAddress.city}</p>
                                    <p className="mt-1">Tel: {shippingAddress.phone}</p>
                                </>
                            ) : (
                                <p className="text-gray-500 italic">Müşteri adresi ile aynı veya belirtilmemiş.</p>
                            )}
                        </div>
                        <div className="mt-4">
                            <h3 className="text-gray-500 font-semibold mb-1 uppercase tracking-wider text-sm">Ödeme Yöntemi</h3>
                            <p className="font-medium">
                                {order.payment?.method === "BANK_TRANSFER" ? "Havale / EFT" : "Kredi Kartı"}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Customer Note */}
            {order.notes && (
                <div className="mb-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <h3 className="text-gray-500 font-semibold mb-2 uppercase tracking-wider text-xs">Müşteri Notu</h3>
                    <p className="text-gray-800 whitespace-pre-wrap">{order.notes}</p>
                </div>
            )}

            {/* Order Items Section - Compact Style for Trendyol */}
            <div className={`mb-6 ${order.source === "TRENDYOL" ? "border-2 border-gray-300 rounded-lg overflow-hidden" : ""}`}>
                {order.source === "TRENDYOL" && (
                    <div className="bg-gray-50 px-5 py-3 border-b-2 border-gray-100">
                        <h3 className="text-lg font-black text-blue-900 uppercase">Ürün Bilgileri</h3>
                    </div>
                )}
                
                {order.source === "TRENDYOL" ? (
                    <div className="p-4 space-y-4">
                        {order.items.map((item, idx) => (
                            <div key={item.id} className="flex items-start gap-4 p-2">
                                <div className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center font-bold shrink-0">
                                    {idx + 1}
                                </div>
                                <div className="flex-1">
                                    <p className="font-black text-sm leading-tight mb-3">{item.productName}</p>
                                    <div className="grid grid-cols-4 text-[10px] text-gray-500 font-medium">
                                        <div className="flex flex-col">
                                            <span>Adet</span>
                                            <span className="text-gray-900 font-bold">{item.quantity} Adet</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span>Varyant</span>
                                            <span className="text-gray-900 font-bold">{item.variantInfo || "-"}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span>Barkod</span>
                                            <span className="text-gray-900 font-bold">{item.variant?.barcode || item.product?.barcode || "-"}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span>Stok Kodu</span>
                                            <span className="text-gray-900 font-bold">{item.variant?.sku || item.product?.sku || "-"}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b-2 border-gray-800">
                                <th className="py-3 font-bold text-gray-700">Ürün Adı</th>
                                <th className="py-3 font-bold text-gray-700 text-center">Adet</th>
                                <th className="py-3 font-bold text-gray-700 text-right">Birim Fiyat</th>
                                <th className="py-3 font-bold text-gray-700 text-right">Toplam</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-700">
                            {order.items.map((item) => (
                                <tr key={item.id} className="border-b border-gray-200">
                                    <td className="py-3">
                                        <div className="font-medium">{item.productName}</div>
                                        <div className="text-xs text-gray-500">KDV: %{item.vatRate}</div>
                                    </td>
                                    <td className="py-3 text-center">{item.quantity}</td>
                                    <td className="py-3 text-right">{formatPrice(toNumber(item.unitPrice))}</td>
                                    <td className="py-3 text-right font-medium">{formatPrice(toNumber(item.lineTotal))}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Totals - Hidden if Trendyol for max compactness, or kept small */}
            <div className="flex justify-end mt-4">
                <div className="w-64 space-y-1.5">
                    <div className="flex justify-between text-sm text-gray-500">
                        <span>Ara Toplam:</span>
                        <span>{formatPrice(toNumber(order.subtotal))}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500">
                        <span>KDV Toplam:</span>
                        <span>{formatPrice(toNumber(order.vatAmount))}</span>
                    </div>
                    <div className="flex justify-between text-lg font-black border-t-2 border-gray-100 pt-1 mt-1">
                        <span>GENEL TOPLAM:</span>
                        <span>{formatPrice(toNumber(order.total))}</span>
                    </div>
                </div>
            </div>

            {/* Bank Info (Only if Bank Transfer) */}
            {order.payment?.method === "BANK_TRANSFER" && (settings.bankIban1 || settings.bankIban2) && (
                <div className="mt-8 p-4 border rounded-lg border-gray-200">
                    <h4 className="font-bold text-gray-800 mb-2">Ödeme Yapılacak Banka Hesapları</h4>
                    <p className="text-sm text-gray-600 mb-2">Lütfen ödeme açıklamasında <strong>sipariş numaranızı (#{order.orderNumber})</strong> belirtiniz.</p>
                    <div className="space-y-1 text-sm font-mono text-gray-700">
                        {settings.bankIban1 && <p>{settings.bankIban1}</p>}
                        {settings.bankIban2 && <p>{settings.bankIban2}</p>}
                    </div>
                </div>
            )}

            {/* Footer Notes */}
            <div className="mt-8 pt-4 border-t border-gray-300 text-center text-[10px] text-gray-400">
                <p>Bu belge bilgilendirme amaçlıdır. Fatura niteliği taşımaz. Teşekkürler, yine bekleriz.</p>
            </div>
        </div>
        </div>
    );
}
