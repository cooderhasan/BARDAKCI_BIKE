import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/helpers";
import { getSiteSettings } from "@/lib/settings";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/admin/print-button";
import { AutoPrint } from "@/components/admin/auto-print";
import { Barcode } from "@/components/admin/barcode";

export default async function ShippingLabelPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const order = await prisma.order.findUnique({
        where: { id },
        include: {
            user: true,
            items: true,
        },
    });

    if (!order) {
        notFound();
    }

    const settings = await getSiteSettings();
    const isN11 = order.source === "N11";

    const shippingAddress = order.shippingAddress as any;

    if (isN11) {
        return (
            <div className="bg-white min-h-screen text-black p-4 mx-auto max-w-[210mm]">
                <style>{`
                    @media print {
                        @page { margin: 0.5cm; }
                        body { -webkit-print-color-adjust: exact; background-color: white !important; }
                        .no-print { display: none !important; }
                        .lg\\:pl-64 { padding-left: 0 !important; }
                        main { padding: 0 !important; margin: 0 !important; width: 100% !important; }
                    }
                    .n11-container {
                        width: 100%;
                        border: 2px solid #000;
                        font-family: Arial, sans-serif;
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
                `}</style>
                <AutoPrint />
                <div className="no-print mb-4 flex justify-between items-center bg-purple-50 p-4 rounded-lg border border-purple-100">
                    <div>
                        <span className="text-purple-700 font-bold block">N11 Kargo Etiketi</span>
                        <span className="text-xs text-purple-600">Ürün listeli özel şablon hazırlanmıştır.</span>
                    </div>
                    <PrintButton />
                </div>

                <div className="n11-container">
                    <div className="n11-section flex justify-between items-center bg-white">
                         <div className="flex-1"></div>
                         <img src="/n11_logo.fw.png" alt="N11" className="h-10 object-contain" />
                         <div className="flex-1 text-right text-sm font-bold">{formatDate(new Date())}</div>
                    </div>

                    <div className="n11-section grid grid-cols-2">
                        <div>
                            <div className="n11-header">Gönderici Bilgileri</div>
                            <div className="text-sm font-medium">
                                <p>Şirket İsmi: <span className="ml-2">{settings.companyName || "emre serin"}</span></p>
                                <p>Şirket Tel: <span className="ml-3">{settings.phone || "5353783949"}</span></p>
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
                            <p>Ev/Cep Telefonu: <span className="ml-2">{shippingAddress?.phone || "5XXXXXXXXX"}</span></p>
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
                            <p className="font-bold">{order.cargoCompany || "DHL e-Commerce"}</p>
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
                                <thead>
                                    <tr className="text-left border-b border-gray-200">
                                        <th className="pb-1">Ürün Adı / Adet</th>
                                    </tr>
                                </thead>
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
                             <div className="text-sm mb-2">Kampanya Kodu : <span className="font-bold">{order.cargoTrackingNumber || order.shipmentPackageId || order.orderNumber}</span></div>
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
            </div>
        );
    }

    return (
        <div className="bg-white min-h-screen text-black p-8 mx-auto max-w-[210mm]">
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
                    }
                    .no-print { display: none !important; }
                    .lg\\:pl-64 { padding-left: 0 !important; }
                    main { padding: 0 !important; margin: 0 !important; width: 100% !important; max-width: none !important; }
                    
                    .label-container {
                        width: 100%;
                        max-width: 100%;
                        border: 2px solid #000;
                        padding: 20px;
                        box-sizing: border-box;
                        page-break-inside: avoid;
                    }
                }
            `}</style>

            <AutoPrint />

            <div className="no-print mb-8 flex justify-between items-center bg-gray-100 p-4 rounded-lg">
                <div className="flex flex-col">
                    <span className="text-gray-600 font-medium">Kargo Etiketi Önizleme</span>
                    <span className="text-xs text-gray-500">Bu sayfa otomatik olarak yazıcı diyaloğunu açar. (A4/A5 Uyumlu)</span>
                </div>
                <PrintButton />
            </div>

            <div className="label-container border-2 border-black p-6 md:p-10 max-w-2xl mx-auto bg-white rounded-none">
                <div className="border-b-2 border-black pb-6 mb-6">
                    <div className="flex justify-between items-start">
                        <div className="w-2/3">
                            <h2 className="text-xs font-bold text-gray-500 uppercase mb-1">GÖNDERİCİ</h2>
                            {settings.logoUrl ? (
                                <img src={settings.logoUrl} alt="Logo" className="h-12 w-auto object-contain mb-2" />
                            ) : (
                                <h1 className="text-xl font-bold uppercase mb-1">{settings.companyName || "Firma Adı"}</h1>
                            )}
                            <div className="text-sm font-medium">
                                <p>{settings.address}</p>
                                <p className="mt-1">{settings.phone} | {settings.email}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <h2 className="text-xs font-bold text-gray-500 uppercase mb-1">TARİH</h2>
                            <p className="font-bold text-lg">{formatDate(order.createdAt)}</p>
                        </div>
                    </div>
                </div>

                <div className="mb-8">
                    <h2 className="text-sm font-bold text-gray-500 uppercase mb-2 border-b border-gray-300 pb-1">ALICI (TESLİMAT ADRESİ)</h2>
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
                        <div className="mt-3 font-mono text-lg">
                            Tel: {shippingAddress?.phone || order.user?.phone || "-"}
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

                    {order.cargoTrackingNumber && (
                        <div className="col-span-2 mt-2 pt-2 border-t border-gray-300">
                            <h2 className="text-xs font-bold text-gray-500 uppercase mb-1">TAKİP NO</h2>
                            <p className="text-sm break-all font-mono">{order.cargoTrackingNumber}</p>
                        </div>
                    )}

                    <div className="col-span-2 mt-4 pt-4 border-t border-black">
                        <div className="flex flex-col items-center justify-center space-y-2">
                             <Barcode 
                                value={(order as any).ykCargoKey || order.cargoTrackingNumber || order.orderNumber} 
                                width={2.5} 
                                height={100} 
                                className="mb-2"
                             />
                             <div className="text-center text-[10px] text-gray-400 font-medium uppercase tracking-widest">
                                {settings.companyName || "Firma Adı"} - Kargo Etiketi
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
