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
        <div className="bg-white min-h-screen text-black p-6 max-w-[210mm] mx-auto font-sans">
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
            <div className="no-print mb-6 flex justify-between items-center bg-gray-100 p-4 rounded-lg">
                <div className="flex flex-col">
                    <span className="text-gray-600 font-medium">Baskı Önizleme</span>
                    <span className="text-xs text-gray-500">Bu sayfa otomatik olarak yazıcı diyaloğunu açar.</span>
                </div>
                <PrintButton />
            </div>

            {/* Main Label Box */}
            <div className="border-2 border-black p-6 rounded-lg space-y-6">
                
                {/* Marketplace Warning Header */}
                {order.source !== "WEB" && order.source && (
                    <div className="border border-black bg-gray-50 p-3 rounded flex items-center gap-3 text-xs font-bold leading-tight">
                        <span className="text-base">⚠️</span>
                        <p className="uppercase tracking-wide">
                            Kargo şirketinin dikkatine: Bu bir {order.source.toLowerCase()}.com gönderisidir. {order.source} anlaşması kapsamında işlem yapılması rica olunur.
                        </p>
                    </div>
                )}

                {/* Top Section: Barcode & Cargo Company */}
                <div className="flex justify-between items-center border-b-2 border-black pb-4">
                    {/* Barcode */}
                    <div className="flex flex-col items-start space-y-1">
                        <span className="text-[10px] font-black uppercase text-gray-400">Kargo Takip / Sipariş Barkodu</span>
                        <div className="bg-white p-1">
                            <Barcode 
                                value={order.cargoTrackingNumber || order.orderNumber} 
                                width={1.8} 
                                height={60} 
                            />
                        </div>
                    </div>

                    {/* Cargo Company Logo */}
                    <div className="text-right">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black uppercase text-gray-400 mb-1">Taşıyıcı Firma</span>
                            {order.cargoCompany ? (
                                <div className="text-2xl font-black tracking-tighter border-2 border-black px-4 py-1.5 rounded bg-black text-white uppercase">
                                    {order.cargoCompany}
                                </div>
                            ) : (
                                <div className="text-xl font-bold tracking-tight border-2 border-dashed border-gray-300 px-4 py-1.5 rounded text-gray-400">
                                    BELİRTİLMEDİ
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Grid 1: Delivery & Billing Details */}
                <div className="grid grid-cols-2 gap-6 border-b border-black pb-6">
                    {/* Delivery Address (Alıcı) */}
                    <div className="space-y-3 border-r border-gray-200 pr-6">
                        <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 border-b border-black pb-1.5 flex items-center gap-1.5">
                            <span>📦</span> TESLİMAT BİLGİLERİ (ALICI)
                        </h3>
                        <div className="text-[11px] space-y-1.5 text-gray-800">
                            <div className="grid grid-cols-[100px_1fr]">
                                <span className="font-bold text-gray-500 uppercase">Teslim Alacak:</span>
                                <span className="font-black text-sm uppercase text-black">
                                    {shippingAddress?.fullName || shippingAddress?.name || order.user?.name || "Belirtilmedi"}
                                </span>
                            </div>
                            <div className="grid grid-cols-[100px_1fr]">
                                <span className="font-bold text-gray-500 uppercase">Semt/İlçe/İl:</span>
                                <span className="font-black uppercase text-black">
                                    {shippingAddress?.district || order.user?.district || "-"} / {shippingAddress?.city || order.user?.city || "-"}
                                </span>
                            </div>
                            <div className="grid grid-cols-[100px_1fr] items-start">
                                <span className="font-bold text-gray-500 uppercase">Adres:</span>
                                <span className="font-bold text-gray-900 leading-tight">
                                    {shippingAddress?.address || order.user?.address || "Belirtilmedi"}
                                </span>
                            </div>
                            <div className="grid grid-cols-[100px_1fr]">
                                <span className="font-bold text-gray-500 uppercase">Telefon:</span>
                                <span className="font-bold text-black">{shippingAddress?.phone || order.user?.phone || "-"}</span>
                            </div>
                        </div>
                    </div>

                    {/* Billing Address (Fatura) */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 border-b border-black pb-1.5 flex items-center gap-1.5">
                            <span>🧾</span> FATURA BİLGİLERİ
                        </h3>
                        <div className="text-[11px] space-y-1.5 text-gray-800">
                            <div className="grid grid-cols-[100px_1fr]">
                                <span className="font-bold text-gray-500 uppercase">Fatura Sahibi:</span>
                                <span className="font-black text-sm uppercase text-black">
                                    {shippingAddress?.fullName || shippingAddress?.name || order.user?.companyName || order.user?.name || "Belirtilmedi"}
                                </span>
                            </div>
                            <div className="grid grid-cols-[100px_1fr]">
                                <span className="font-bold text-gray-500 uppercase">Semt/İlçe/İl:</span>
                                <span className="font-black uppercase text-black">
                                    {shippingAddress?.district || order.user?.district || "-"} / {shippingAddress?.city || order.user?.city || "-"}
                                </span>
                            </div>
                            <div className="grid grid-cols-[100px_1fr] items-start">
                                <span className="font-bold text-gray-900 leading-tight">
                                    {shippingAddress?.address || order.user?.address || "Belirtilmedi"}
                                </span>
                            </div>
                            {shippingAddress?.taxNumber && (
                                <div className="grid grid-cols-[100px_1fr]">
                                    <span className="font-bold text-gray-500 uppercase">Vergi/T.C. No:</span>
                                    <span className="font-bold text-black">{shippingAddress.taxNumber}</span>
                                </div>
                            )}
                            {shippingAddress?.taxOffice && (
                                <div className="grid grid-cols-[100px_1fr]">
                                    <span className="font-bold text-gray-500 uppercase">Vergi Dairesi:</span>
                                    <span className="font-bold uppercase text-black">{shippingAddress.taxOffice}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Grid 2: Seller & Order Info */}
                <div className="grid grid-cols-2 gap-6 border-b border-black pb-6">
                    {/* Seller Details */}
                    <div className="space-y-3 border-r border-gray-200 pr-6">
                        <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 border-b border-black pb-1.5 flex items-center gap-1.5">
                            <span>🏢</span> SATICI BİLGİLERİ
                        </h3>
                        <div className="text-[11px] space-y-1.5 text-gray-800">
                            <div className="grid grid-cols-[100px_1fr]">
                                <span className="font-bold text-gray-500 uppercase">Satıcı Adı:</span>
                                <span className="font-black text-xs uppercase text-black">
                                    {settings.companyName || "MOTOVİTRİN (MEHMET FATİH BARDAKCI)"}
                                </span>
                            </div>
                            <div className="grid grid-cols-[100px_1fr] items-start">
                                <span className="font-bold text-gray-500 uppercase">Adres:</span>
                                <span className="font-medium leading-tight text-gray-700">
                                    {settings.address || "Vişnelik, Odunpazarı, Eskişehir"}
                                </span>
                            </div>
                            <div className="grid grid-cols-[100px_1fr]">
                                <span className="font-bold text-gray-500 uppercase">İletişim:</span>
                                <span className="font-medium text-gray-700">
                                    {settings.phone} | {settings.email}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Order Details */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 border-b border-black pb-1.5 flex items-center gap-1.5">
                            <span>📋</span> SİPARİŞ BİLGİLERİ
                        </h3>
                        <div className="text-[11px] space-y-1.5 text-gray-800">
                            <div className="grid grid-cols-[100px_1fr]">
                                <span className="font-bold text-gray-500 uppercase">Sipariş No:</span>
                                <span className="font-black text-sm text-black">#{order.orderNumber}</span>
                            </div>
                            <div className="grid grid-cols-[100px_1fr]">
                                <span className="font-bold text-gray-500 uppercase">Sipariş Tarihi:</span>
                                <span className="font-bold text-black">{formatDate(order.createdAt)}</span>
                            </div>
                            <div className="grid grid-cols-[100px_1fr]">
                                <span className="font-bold text-gray-500 uppercase">Ödeme Tipi:</span>
                                <span className="font-bold uppercase text-black">
                                    {order.payment?.method === "BANK_TRANSFER" ? "Havale / EFT" : "Kredi Kartı"}
                                </span>
                            </div>
                            {order.notes && (
                                <div className="grid grid-cols-[100px_1fr] items-start">
                                    <span className="font-bold text-red-500 uppercase">Müşteri Notu:</span>
                                    <span className="font-bold text-red-600 bg-red-50 px-1 py-0.5 rounded leading-tight">
                                        {order.notes}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Grid 3: Order Items */}
                <div className="space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 border-b border-black pb-1.5 flex items-center gap-1.5">
                        <span>🛒</span> SİPARİŞ EDİLEN ÜRÜNLER (KONTROL LİSTESİ)
                    </h3>
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-black bg-gray-50">
                                <th className="py-2 px-3 font-black text-[11px] text-gray-700 uppercase">Ürün Adı</th>
                                <th className="py-2 px-3 font-black text-[11px] text-gray-700 uppercase text-center w-[150px]">Stok Kodu (SKU)</th>
                                <th className="py-2 px-3 font-black text-[11px] text-gray-700 uppercase text-center w-[150px]">Barkod</th>
                                <th className="py-2 px-3 font-black text-[11px] text-gray-700 uppercase text-right w-[80px]">Adet</th>
                            </tr>
                        </thead>
                        <tbody>
                            {order.items.map((item) => (
                                <tr key={item.id} className="border-b border-gray-200">
                                    <td className="py-2.5 px-3">
                                        <div className="font-black text-xs text-gray-900 leading-snug">{item.productName}</div>
                                        {item.variantInfo && (
                                            <div className="text-[10px] font-bold text-[#17457C] mt-0.5">Varyant: {item.variantInfo}</div>
                                        )}
                                    </td>
                                    <td className="py-2.5 px-3 text-center font-mono font-bold text-xs text-gray-800">
                                        {item.variant?.sku || item.product?.sku || "-"}
                                    </td>
                                    <td className="py-2.5 px-3 text-center font-mono text-xs text-gray-600">
                                        {item.variant?.barcode || item.product?.barcode || "-"}
                                    </td>
                                    <td className="py-2.5 px-3 text-right">
                                        <span className="inline-block bg-black text-white text-xs font-black px-2.5 py-0.5 rounded-full">
                                            {item.quantity}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Prices: Visible only for WEB orders to keep marketplace prices confidential if preferred */}
                {order.source === "WEB" && (
                    <div className="flex justify-end pt-2">
                        <div className="w-64 space-y-1.5">
                            <div className="flex justify-between text-[11px] font-bold text-gray-500">
                                <span>ARA TOPLAM:</span>
                                <span className="text-gray-900">{formatPrice(toNumber(order.subtotal))}</span>
                            </div>
                            <div className="flex justify-between text-[11px] font-bold text-gray-500">
                                <span>KDV TOPLAM:</span>
                                <span className="text-gray-900">{formatPrice(toNumber(order.vatAmount))}</span>
                            </div>
                            <div className="flex justify-between text-sm font-black text-black border-t-2 border-black pt-1.5 mt-1">
                                <span>GENEL TOPLAM:</span>
                                <span>{formatPrice(toNumber(order.total))}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer Disclaimer */}
                <div className="pt-6 text-center border-t border-dashed border-gray-300 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    Bu belge paketleme ve kontrol listesidir. Fatura niteliği taşımaz. Bizi tercih ettiğiniz için teşekkür ederiz!
                </div>
            </div>
        </div>
    );
}
