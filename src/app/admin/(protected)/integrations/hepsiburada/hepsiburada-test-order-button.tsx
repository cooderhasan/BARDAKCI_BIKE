"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Loader2, Package, FileText, RefreshCw, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { createHepsiburadaTestOrder, getHepsiburadaSitOrders, packageHepsiburadaOrder, sendHepsiburadaInvoiceLink } from "./actions";
import { toast } from "sonner";

export function HepsiburadaTestOrderButton() {
    const [loading, setLoading] = useState(false);
    const [orders, setOrders] = useState<any[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [packagedOrders, setPackagedOrders] = useState<Record<string, string>>({}); // orderNumber -> packageNumber

    const loadOrders = async () => {
        setOrdersLoading(true);
        try {
            const res = await getHepsiburadaSitOrders();
            if (res.success && res.orders) {
                setOrders(res.orders);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setOrdersLoading(false);
        }
    };

    useEffect(() => { loadOrders(); }, []);

    const handleCreateOrder = async () => {
        if (!confirm("Hepsiburada SIT (Test) ortamında hayali bir sipariş oluşturulacak. Emin misiniz?")) return;
        setLoading(true);
        try {
            const res = await createHepsiburadaTestOrder();
            if (res.success) {
                toast.success(res.message);
                await loadOrders();
            } else {
                toast.error(res.message);
            }
        } catch (error) {
            toast.error("İşlem sırasında bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    const handlePackage = async (orderNumber: string, lineIds: string[]) => {
        if (!lineIds.length) {
            toast.error("Paketlenecek kalem bulunamadı.");
            return;
        }
        setActionLoading(`pack-${orderNumber}`);
        try {
            const res = await packageHepsiburadaOrder(orderNumber, lineIds);
            if (res.success) {
                toast.success(res.message);
                // packageNumber'ı response'dan veya generate edilmişten al
                const pkgNum = res.data?.packageNumber || res.data?.id || `PKG-${Date.now()}`;
                setPackagedOrders(prev => ({ ...prev, [orderNumber]: pkgNum }));
                await loadOrders();
            } else {
                toast.error(res.message);
            }
        } catch (e) {
            toast.error("Paketleme hatası.");
        } finally {
            setActionLoading(null);
        }
    };

    const handleInvoice = async (packageNumber: string) => {
        setActionLoading(`inv-${packageNumber}`);
        try {
            const res = await sendHepsiburadaInvoiceLink(packageNumber);
            if (res.success) {
                toast.success(res.message);
                await loadOrders();
            } else {
                toast.error(res.message);
            }
        } catch (e) {
            toast.error("Fatura gönderme hatası.");
        } finally {
            setActionLoading(null);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'open':
            case 'new':
            case 'unpacked':
                return <Clock className="w-3.5 h-3.5 text-yellow-500" />;
            case 'packed':
            case 'shipped':
                return <Package className="w-3.5 h-3.5 text-blue-500" />;
            case 'delivered':
                return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
            default:
                return <AlertCircle className="w-3.5 h-3.5 text-gray-400" />;
        }
    };

    return (
        <div className="rounded-lg border bg-orange-50 border-orange-200 text-orange-900 shadow-sm p-6 space-y-5">
            {/* Başlık */}
            <div className="flex items-center justify-between">
                <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    SIT Test Sipariş Yönetimi
                </h3>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadOrders}
                    disabled={ordersLoading}
                    className="text-orange-600 hover:text-orange-800 h-8"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${ordersLoading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            {/* Adım 1: Sipariş Oluştur */}
            <div>
                <p className="text-xs text-orange-700 font-medium mb-2">Adım 1: Test Siparişi Oluştur</p>
                <Button 
                    onClick={handleCreateOrder}
                    disabled={loading}
                    size="sm"
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white gap-2"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                    Test Siparişi Oluştur
                </Button>
            </div>

            {/* Sipariş Listesi */}
            {orders.length > 0 && (
                <div className="space-y-3">
                    <p className="text-xs text-orange-700 font-medium">Mevcut SIT Siparişleri ({orders.length})</p>
                    {orders.map((order) => (
                        <div key={order.orderNumber} className="bg-white rounded-lg border border-orange-100 p-3 space-y-2">
                            {/* Sipariş başlığı */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {getStatusIcon(order.status)}
                                    <span className="text-xs font-mono font-medium">{order.orderNumber}</span>
                                </div>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                    order.status === 'Open' ? 'bg-yellow-100 text-yellow-700' :
                                    order.status === 'Packed' ? 'bg-blue-100 text-blue-700' :
                                    order.status === 'Shipped' ? 'bg-green-100 text-green-700' :
                                    'bg-gray-100 text-gray-600'
                                }`}>
                                    {order.status}
                                </span>
                            </div>

                            {/* Sipariş kalemleri */}
                            {order.lines?.length > 0 && (
                                <div className="text-[11px] text-gray-600 space-y-0.5">
                                    {order.lines.map((line: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between">
                                            <span>{line.merchantSku || line.hepsiburadaSku} x{line.quantity}</span>
                                            <span className="text-gray-400">{line.status}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Aksiyon butonları */}
                            <div className="flex gap-2 pt-1">
                                {/* Adım 2: Paketle */}
                                {(order.status === 'Open' || order.status === 'New' || order.status === 'Unpacked') && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 h-7 text-[11px] border-blue-200 text-blue-700 hover:bg-blue-50 gap-1"
                                        disabled={actionLoading === `pack-${order.orderNumber}`}
                                        onClick={() => handlePackage(
                                            order.orderId || order.orderNumber,
                                            order.lines?.map((l: any) => l.id).filter(Boolean) || []
                                        )}
                                    >
                                        {actionLoading === `pack-${order.orderNumber}` 
                                            ? <Loader2 className="w-3 h-3 animate-spin" /> 
                                            : <Package className="w-3 h-3" />
                                        }
                                        Paketle
                                    </Button>
                                )}

                                {/* Adım 3: Fatura Gönder - paketlenmiş siparişlerde göster */}
                                {(packagedOrders[order.orderNumber] || order.lines?.some((l: any) => l.packageNumber)) && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 h-7 text-[11px] border-green-200 text-green-700 hover:bg-green-50 gap-1"
                                        disabled={actionLoading?.startsWith('inv-')}
                                        onClick={() => {
                                            const pkg = packagedOrders[order.orderNumber] || order.lines?.find((l: any) => l.packageNumber)?.packageNumber;
                                            if (pkg) handleInvoice(pkg);
                                            else toast.error("Package number bulunamadı.");
                                        }}
                                    >
                                        {actionLoading?.startsWith('inv-') 
                                            ? <Loader2 className="w-3 h-3 animate-spin" /> 
                                            : <FileText className="w-3 h-3" />
                                        }
                                        Fatura Gönder
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <p className="text-[10px] text-orange-600 italic text-center">
                * SIT test akışı: Sipariş Oluştur → Paketle → Fatura Gönder
            </p>
        </div>
    );
}
