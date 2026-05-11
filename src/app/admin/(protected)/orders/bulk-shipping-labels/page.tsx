import { prisma } from "@/lib/db";
import { getSiteSettings } from "@/lib/settings";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/admin/print-button";
import { AutoPrint } from "@/components/admin/auto-print";
import { Barcode } from "@/components/admin/barcode";
import { CloseButton } from "@/components/admin/close-button";

interface BulkShippingLabelPageProps {
    searchParams: Promise<{ ids?: string }>;
}

export default async function BulkShippingLabelPage({ searchParams }: BulkShippingLabelPageProps) {
    const { ids } = await searchParams;

    if (!ids) {
        return (
            <div className="p-8 text-center text-gray-500">
                Hiçbir sipariş seçilmedi.
            </div>
        );
    }

    const orderIdList = ids.split(",");

    const orders = await prisma.order.findMany({
        where: {
            id: { in: orderIdList },
        },
        include: {
            user: true,
            items: true, // Include items for product lists
        },
        orderBy: { createdAt: "desc" },
    });

    if (orders.length === 0) {
        notFound();
    }

    const settings = await getSiteSettings();

    return (
        <div className="bg-gray-100 min-h-screen">
            <style>{`
                @media print {
                    @page { margin: 0.5cm; size: auto; }
                    body { -webkit-print-color-adjust: exact; background-color: white !important; margin: 0; padding: 0; color: black !important; }
                    .no-print, header, aside { display: none !important; }
                    .print-page-break { page-break-after: always; }
                    .lg\\:pl-64 { padding-left: 0 !important; }
                    main { padding: 0 !important; margin: 0 !important; width: 100% !important; max-width: none !important; }
                    
                    .label-container {
                        width: 100%;
                        max-width: 100%;
                        border: 2px solid #000;
                        box-sizing: border-box;
                        page-break-inside: avoid;
                    }
                    .n11-container {
                        width: 100%;
                        border: 2px solid #000;
                        font-family: Arial, sans-serif;
                        page-break-inside: avoid;
                    }
                    .n11-section {
                        border-bottom: 2px solid #000;
                        padding: 8px 12px;
                    }
                    .n11-header {
                        font-size: 10px;
                        font-weight: bold;
                        color: #666;
                        text-transform: uppercase;
                        margin-bottom: 4px;
                    }
                }
            `}</style>

            <AutoPrint />

            <div className="no-print sticky top-0 z-50 p-4 bg-white border-b shadow-sm flex justify-between items-center">
                <div className="flex flex-col">
                    <span className="text-gray-900 font-bold">Toplu Kargo Etiketi Yazdırma ({orders.length} Etiket)</span>
                    <span className="text-xs text-gray-500">N11 siparişleri için ürün listeli özel şablon kullanılır.</span>
                </div>
                <div className="flex gap-4 items-center">
                    <CloseButton />
                    <PrintButton />
                </div>
            </div>

            <div className="flex flex-col gap-8 p-8 items-center bg-gray-100 print:bg-white print:p-0 print:gap-0">
                {orders.map((order, index) => {
                    const shippingAddress = order.shippingAddress as any;
                    const isN11 = order.source === "N11";

                    return (
                        <div
                            key={order.id}
                            className={`bg-white text-black p-8 w-full max-w-[210mm] shadow-sm print:shadow-none print:p-4 ${
                                index !== orders.length - 1 ? "print-page-break" : ""
                            }`}
                        >
                            {isN11 ? (
                                /* N11 Custom Template */
                                <div className="n11-container mx-auto">
                                    <div className="n11-section flex justify-between items-center bg-white">
                                         <div className="flex-1"></div>
                                         <img src="/n11_logo.fw.png" alt="N11" className="h-10 object-contain" />
                                         <div className="flex-1 text-right text-sm font-bold">{new Date(order.createdAt).toLocaleDateString('tr-TR')}</div>
                                    </div>

                                    <div className="n11-section grid grid-cols-2">
                                        <div>
                                            <div className="n11-header">Gönderici Bilgileri</div>
                                            <div className="text-sm font-medium">
                                                <p>Şirket İsmi: <span className="ml-2">{settings.companyName || "SERİN MOTOR"}</span></p>
                                                <p>Şirket Tel: <span className="ml-3">{settings.phone}</span></p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="n11-section">
                                        <div className="n11-header">Alıcı Bilgileri</div>
                                        <div className="text-sm space-y-1">
                                            <p className="font-bold text-base">Ad/Soyad: <span className="ml-4">{shippingAddress?.fullName || "Müşteri"}</span></p>
                                            <p>Adres: <span className="ml-8">{shippingAddress?.address || "-"}</span></p>
                                            <div className="grid grid-cols-3">
                                                <p>Semt: <span className="ml-10">{shippingAddress?.district || "-"}</span></p>
                                                <p>Şehir: <span className="ml-10">{shippingAddress?.city || "-"}</span></p>
                                                <p>Posta Kodu: <span className="ml-4">{shippingAddress?.postalCode || "-"}</span></p>
                                            </div>
                                            <p>Ev/Cep Telefonu: <span className="ml-2">{shippingAddress?.phone || "-"}</span></p>
                                            <p>Ödeme Tipi: <span className="ml-6 font-bold">N11 Öder</span></p>
                                        </div>
                                    </div>

                                    <div className="n11-section grid grid-cols-3 text-sm">
                                        <div>
                                            <div className="n11-header">Sipariş Bilgileri</div>
                                            <p>Sipariş Numarası:</p>
                                            <p className="font-bold">{order.orderNumber}</p>
                                        </div>
                                        <div>
                                            <div className="n11-header">&nbsp;</div>
                                            <p>Kargo Firması:</p>
                                            <p className="font-bold">{order.cargoCompany || "-"}</p>
                                        </div>
                                        <div>
                                            <div className="n11-header">&nbsp;</div>
                                            <p>Ödeme Tipi:</p>
                                            <p className="font-bold">N11 Öder</p>
                                        </div>
                                    </div>

                                    <div className="n11-section">
                                        <div className="n11-header">Ürün Listesi</div>
                                        <div className="text-sm">
                                            <table className="w-full">
                                                <tbody>
                                                    {order.items.map((item, idx) => (
                                                        <tr key={idx}>
                                                            <td className="py-1">
                                                                {item.productName} / Adet : {item.quantity}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div className="p-4 flex items-center gap-6">
                                        <div className="flex-1">
                                             <div className="text-sm mb-2 font-bold uppercase tracking-wider">Kampanya Kodu : {order.cargoTrackingNumber || order.shipmentPackageId || order.orderNumber}</div>
                                             <Barcode 
                                                value={order.cargoTrackingNumber || order.shipmentPackageId || order.orderNumber} 
                                                width={2} 
                                                height={80} 
                                             />
                                        </div>
                                        <div className="flex-1 text-[10px] italic text-gray-500 leading-tight">
                                            Kampanya kodunun hata vermesi durumunda çıkış yapmayınız, gönderici firma ile irtibata geçiniz.
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* Standard Template */
                                <div className="label-container border-2 border-black p-6 md:p-10 mx-auto bg-white rounded-none">
                                    <div className="border-b-2 border-black pb-6 mb-6">
                                        <div className="flex justify-between items-start">
                                            <div className="w-2/3">
                                                <h2 className="text-xs font-bold text-gray-500 uppercase mb-1">GÖNDERİCİ</h2>
                                                {settings.logoUrl && (
                                                    <img src={settings.logoUrl} alt="Logo" className="h-12 w-auto object-contain mb-1" />
                                                )}
                                                <h1 className="text-lg font-bold uppercase mb-1">{settings.companyName || "SERİN MOTOR"}</h1>
                                                <div className="text-sm font-medium">
                                                    <p>{settings.address}</p>
                                                    <p className="mt-1">{settings.phone} | {settings.email}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <h2 className="text-xs font-bold text-gray-500 uppercase mb-1">TARİH</h2>
                                                <p className="font-bold text-lg">{new Date(order.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mb-8">
                                        <h2 className="text-sm font-bold text-gray-500 uppercase mb-2 border-b border-gray-300 pb-1 flex items-center gap-2">
                                            ALICI (TESLİMAT ADRESİ) 
                                            {order.source === "TRENDYOL" && <span className="bg-[#f27a1a] text-white text-[10px] px-1.5 py-0.5 rounded font-bold">TRENDYOL</span>}
                                        </h2>
                                        <div className="pl-2">
                                            <div className="text-2xl font-bold uppercase mb-2 leading-tight">
                                                {shippingAddress?.fullName || shippingAddress?.name || order.user?.companyName || order.user?.email || (order as any).guestEmail || "Müşteri"}
                                            </div>
                                            <div className="text-lg font-medium whitespace-pre-wrap leading-snug mb-2">
                                                {shippingAddress?.address || order.user?.address || "Adres bilgisi yok"}
                                            </div>
                                            <div className="text-xl font-bold uppercase">
                                                {shippingAddress?.district || order.user?.district} / {shippingAddress?.city || order.user?.city}
                                            </div>
                                            <div className="mt-3 font-mono text-lg flex justify-between items-end">
                                                <span>Tel: {shippingAddress?.phone || order.user?.phone || "-"}</span>
                                                {order.source === "TRENDYOL" && (
                                                    <div className="text-right flex flex-col items-end">
                                                        <span className="text-[10px] text-gray-400">PAKET ID</span>
                                                        <span className="text-sm font-bold">{(order as any).shipmentPackageId || "-"}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 border-t-2 border-black pt-6">
                                        <div>
                                            <h2 className="text-xs font-bold text-gray-500 uppercase mb-1">SİPARİŞ NO</h2>
                                            <p className="text-2xl font-mono font-bold">#{order.orderNumber}</p>
                                        </div>
                                        <div>
                                            <h2 className="text-xs font-bold text-gray-500 uppercase mb-1">KARGO FİRMASI</h2>
                                            <p className="text-xl font-bold uppercase">{order.cargoCompany || "BELİRTİLMEDİ"}</p>
                                        </div>

                                        {(order as any).trackingUrl && (
                                            <div className="col-span-2 mt-2 pt-2 border-t border-gray-300">
                                                <h2 className="text-xs font-bold text-gray-500 uppercase mb-1">TAKİP NO / LİNK</h2>
                                                <p className="text-sm break-all font-mono">{(order as any).trackingUrl}</p>
                                            </div>
                                        )}

                                        <div className="col-span-2 mt-4 pt-4 border-t border-black">
                                            <div className="flex flex-col items-center justify-center space-y-2">
                                                 <Barcode 
                                                    value={order.cargoTrackingNumber || (order as any).ykCargoKey || order.orderNumber} 
                                                    width={2.5} 
                                                    height={100} 
                                                    className="mb-2"
                                                 />
                                                 <div className="text-center text-[10px] text-gray-400 font-medium uppercase tracking-widest">
                                                    {(settings.companyName || "Firma Adı")} - Kargo Etiketi
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
