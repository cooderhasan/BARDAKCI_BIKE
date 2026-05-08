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
        },
        orderBy: { createdAt: "desc" },
    });

    if (orders.length === 0) {
        notFound();
    }

    const settings = await getSiteSettings();

    return (
        <div className="bg-gray-100 min-h-screen">
            {/* Print CSS to handle page breaks and layout */}
            <style>{`
                @media print {
                    @page { 
                        margin: 1cm; 
                        size: auto; 
                    }
                    body { 
                        -webkit-print-color-adjust: exact; 
                        background-color: white !important; 
                        margin: 0;
                        padding: 0;
                        color: black !important;
                    }
                    .no-print, header, aside { display: none !important; }
                    .print-page-break { page-break-after: always; }
                    .lg\\:pl-64 { padding-left: 0 !important; }
                    main { padding: 0 !important; margin: 0 !important; width: 100% !important; max-width: none !important; }
                    
                    .label-container {
                        width: 100%;
                        max-width: 100%;
                        border: 2px solid #000;
                        padding: 20px;
                        box-sizing: border-box;
                        page-break-inside: avoid;
                        margin-bottom: 0 !important;
                    }
                }
            `}</style>

            <AutoPrint />

            {/* Actions (Hidden in Print) */}
            <div className="no-print sticky top-0 z-50 p-4 bg-white border-b shadow-sm flex justify-between items-center">
                <div className="flex flex-col">
                    <span className="text-gray-900 font-bold">Toplu Kargo Etiketi Yazdırma ({orders.length} Etiket)</span>
                    <span className="text-xs text-gray-500">Her etiket ayrı bir sayfada yazdırılacaktır. (Barkodlar Dahil)</span>
                </div>
                <div className="flex gap-4 items-center">
                    <CloseButton />
                    <PrintButton />
                </div>
            </div>

            <div className="flex flex-col gap-8 p-8 items-center bg-gray-100 print:bg-white print:p-0 print:gap-0">
                {orders.map((order, index) => {
                    const shippingAddress = order.shippingAddress as any;

                    return (
                        <div
                            key={order.id}
                            className={`bg-white text-black p-8 w-full max-w-[210mm] shadow-sm print:shadow-none print:p-4 ${
                                index !== orders.length - 1 ? "print-page-break" : ""
                            }`}
                        >
                            {/* Label Content - Reusing single label structure */}
                            <div className="label-container border-2 border-black p-6 md:p-10 mx-auto bg-white rounded-none">
                                {/* Header / Sender Info */}
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

                                {/* Receiver Info */}
                                <div className="mb-8">
                                    <h2 className="text-sm font-bold text-gray-500 uppercase mb-2 border-b border-gray-300 pb-1">
                                        ALICI (TESLİMAT ADRESİ) {order.source === "TRENDYOL" && <span className="ml-2 bg-[#f27a1a] text-white text-[10px] px-1.5 py-0.5 rounded font-bold">TRENDYOL</span>}
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

                                {/* Cargo & Order Info Grid */}
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
                                                {order.source === "TRENDYOL" ? "Trendyol Siparişi" : (settings.companyName || "Firma Adı")} - Kargo Etiketi
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
