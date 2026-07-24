"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Eye, FileDown, Search, X, Printer, CheckCircle2, Truck, MessageCircle, ExternalLink, Pencil, Package, RefreshCw, XCircle, SendHorizonal, Barcode, ReceiptText } from "lucide-react";
import {
    formatDate,
    getOrderStatusLabel,
    getOrderStatusColor,
    formatPrice,
} from "@/lib/helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { updateOrderStatus, updateOrderTracking, bulkUpdateOrderStatus, sendOrderToYurtici, cancelYKOrder, queryYKOrder, bulkSendOrdersToYurtici, syncAllYKOrders, markOrderAsPrinted, markOrdersAsPrinted } from "@/app/admin/(protected)/orders/actions";
import { sendOrderInvoice } from "@/app/admin/(protected)/integrations/trendyol-efaturam/actions";
import { getYKStatusLabel, getYKStatusColor } from "@/services/yurtici/api";
import { toast } from "sonner";
import { OrderWithItems } from "@/types";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { YurticiKargoPanel } from "@/components/admin/yurtici-kargo-panel";

interface OrdersTableProps {
    orders: OrderWithItems[];
    pagination?: {
        currentPage: number;
        totalPages: number;
        totalCount: number;
    };
}

const orderStatuses = [
    { value: "ALL", label: "Tümü" },
    { value: "PENDING", label: "Ödeme Bekleniyor" },
    { value: "CONFIRMED", label: "Onaylandı" },
    { value: "PROCESSING", label: "Hazırlanıyor" },
    { value: "SHIPPED", label: "Kargolandı" },
    { value: "DELIVERED", label: "Tamamlandı" },
    { value: "CANCELLED", label: "İptal Edildi" },
];

export function OrdersTable({ orders: initialOrders, pagination }: OrdersTableProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Filter States
    const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
    const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "ALL");
    const [cargoFilter, setCargoFilter] = useState(searchParams.get("cargo") || "ALL");
    const [sourceFilter, setSourceFilter] = useState(searchParams.get("source") || "ALL");
    const [invoiceFilter, setInvoiceFilter] = useState(searchParams.get("invoice") || "ALL");
    const [printedFilter, setPrintedFilter] = useState(searchParams.get("printed") || "ALL");
    const [startDate, setStartDate] = useState(searchParams.get("startDate") || "");
    const [endDate, setEndDate] = useState(searchParams.get("endDate") || "");

    const [orders, setOrders] = useState(initialOrders);
    const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [loadingId, setLoadingId] = useState<string | null>(null);

    // Selection State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isBulkLoading, setIsBulkLoading] = useState(false);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const [isSyncingYK, setIsSyncingYK] = useState(false);

    // Sync local order state when props change (due to server refetch)
    useEffect(() => {
        setOrders(initialOrders);
        setSelectedIds([]); // Reset selection on page change or filter change
    }, [initialOrders]);

    // Auto-open order detail if "open" parameter is present
    useEffect(() => {
        const openId = searchParams.get("open");
        if (openId) {
            const foundOrder = orders.find(o => o.id === openId);
            if (foundOrder) {
                setSelectedOrder(foundOrder);
                setIsOpen(true);
            }
        }
    }, [searchParams, orders]);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (!open) {
            const params = new URLSearchParams(searchParams.toString());
            if (params.has("open")) {
                params.delete("open");
                router.push(`?${params.toString()}`);
            }
        }
    };

    // Handle Search/Filter Application
    const applyFilters = () => {
        const params = new URLSearchParams(searchParams.toString());

        if (searchTerm) params.set("search", searchTerm);
        else params.delete("search");

        if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
        else params.delete("status");

        if (cargoFilter && cargoFilter !== "ALL") params.set("cargo", cargoFilter);
        else params.delete("cargo");

        if (sourceFilter && sourceFilter !== "ALL") params.set("source", sourceFilter);
        else params.delete("source");

        if (invoiceFilter && invoiceFilter !== "ALL") params.set("invoice", invoiceFilter);
        else params.delete("invoice");

        if (printedFilter && printedFilter !== "ALL") params.set("printed", printedFilter);
        else params.delete("printed");

        if (startDate) params.set("startDate", startDate);
        else params.delete("startDate");

        if (endDate) params.set("endDate", endDate);
        else params.delete("endDate");

        // Reset to page 1 on filter change
        params.set("page", "1");

        router.push(`?${params.toString()}`);
    };

    // Handle Reset
    const resetFilters = () => {
        setSearchTerm("");
        setStatusFilter("ALL");
        setCargoFilter("ALL");
        setSourceFilter("ALL");
        setInvoiceFilter("ALL");
        setPrintedFilter("ALL");
        setStartDate("");
        setEndDate("");
        router.push("/admin/orders");
    };

    // Handle Pagination
    const handlePageChange = (newPage: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("page", newPage.toString());
        router.push(`?${params.toString()}`);
    };

    const handleStatusChange = async (orderId: string, newStatus: string) => {
        setLoadingId(orderId);
        try {
            const result = await updateOrderStatus(orderId, newStatus as any);
            if (result && result.success) {
                setOrders((prev) =>
                    prev.map((order) =>
                        order.id === orderId ? { ...order, status: newStatus } : order
                    )
                );
                toast.success("Sipariş durumu güncellendi");
            } else {
                toast.error(result.error || "Güncelleme başarısız oldu");
            }
        } catch (error) {
            toast.error("Bir hata oluştu");
        } finally {
            setLoadingId(null);
        }
    };

    const handleSendInvoice = async (orderId: string) => {
        setLoadingId(orderId);
        try {
            const result = await sendOrderInvoice(orderId);
            if (result.success) {
                toast.success(result.message);
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            toast.error("Fatura gönderilirken bir hata oluştu.");
        } finally {
            setLoadingId(null);
        }
    };

    // Bulk Handlers
    const toggleSelectAll = () => {
        if (selectedIds.length === orders.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(orders.map(o => o.id));
        }
    };

    const toggleSelect = (orderId: string) => {
        setSelectedIds(prev =>
            prev.includes(orderId)
                ? prev.filter(id => id !== orderId)
                : [...prev, orderId]
        );
    };

    const handleBulkStatusUpdate = async (newStatus: string) => {
        if (selectedIds.length === 0) return;

        setIsBulkLoading(true);
        try {
            const result = await bulkUpdateOrderStatus(selectedIds, newStatus as any);
            if (result.success) {
                toast.success(`${selectedIds.length} sipariş durumu güncellendi`);
                setSelectedIds([]);
                router.refresh();
            } else {
                toast.error(result.error);
            }
        } catch (error) {
            toast.error("Toplu güncelleme sırasında bir hata oluştu");
        } finally {
            setIsBulkLoading(false);
        }
    };

    const handleBulkPrint = async () => {
        if (selectedIds.length === 0) return;
        window.open(`/admin/orders/bulk-print?ids=${selectedIds.join(',')}`, '_blank');
        // Yazdırılanları otomatik işaretle
        try {
            await markOrdersAsPrinted(selectedIds);
            setOrders(prev => prev.map(o =>
                selectedIds.includes(o.id) ? { ...o, isPrinted: true } : o
            ));
        } catch (e) {
            console.error("Mark as printed error:", e);
        }
    };

    const handleBulkShippingLabels = () => {
        if (selectedIds.length === 0) return;
        window.open(`/admin/orders/bulk-shipping-labels?ids=${selectedIds.join(',')}`, '_blank');
    };

    const handleBulkMarkPrinted = async () => {
        if (selectedIds.length === 0) return;
        setIsBulkLoading(true);
        try {
            const result = await markOrdersAsPrinted(selectedIds);
            if (result.success) {
                setOrders(prev => prev.map(o =>
                    selectedIds.includes(o.id) ? { ...o, isPrinted: true } : o
                ));
                toast.success(`${selectedIds.length} sipariş yazdırıldı olarak işaretlendi`);
                setSelectedIds([]);
            }
        } catch (e) {
            toast.error("İşlem başarısız.");
        } finally {
            setIsBulkLoading(false);
        }
    };

    const handleBulkSendYK = async () => {
        if (selectedIds.length === 0) return;

        if (!confirm(`${selectedIds.length} adet sipariş Yurtiçi Kargo'ya gönderilecek. Onaylıyor musunuz?`)) {
            return;
        }

        setIsBulkLoading(true);
        try {
            const result = await bulkSendOrdersToYurtici(selectedIds);
            if (result.success) {
                if (result.error) {
                    toast.error(result.message, {
                        description: "Hatalar:\n" + result.error,
                        duration: 5000,
                    });
                } else {
                    toast.success(result.message);
                }
                setSelectedIds([]);
                router.refresh();
            } else {
                toast.error(result.error);
            }
        } catch (error) {
            toast.error("Toplu gönderim sırasında bir hata oluştu");
        } finally {
            setIsBulkLoading(false);
        }
    };

    const handleBulkInvoice = async () => {
        // Sadece faturası kesilmemiş siparişleri filtrele
        const invoicableOrders = orders.filter(
            o => selectedIds.includes(o.id) && !(o as any).invoiceNo
        );
        if (invoicableOrders.length === 0) {
            toast.info("Seçili siparişlerin tamamının faturası zaten kesilmiş.");
            return;
        }

        if (!confirm(`${invoicableOrders.length} adet sipariş için fatura kesilecek. Onaylıyor musunuz?`)) {
            return;
        }

        // UI'ı kitlemeden arka planda işle
        let success = 0;
        let failed = 0;
        const total = invoicableOrders.length;
        
        const toastId = toast.loading(`Toplu fatura: 0/${total} işleniyor...`);

        for (let i = 0; i < invoicableOrders.length; i++) {
            const order = invoicableOrders[i];
            try {
                toast.loading(`Toplu fatura: ${i + 1}/${total} - #${order.orderNumber}...`, { id: toastId });
                const result = await sendOrderInvoice(order.id);
                if (result.success) {
                    success++;
                } else {
                    failed++;
                    console.warn(`Fatura hatası (#${order.orderNumber}):`, result.message);
                }
            } catch (error) {
                failed++;
                console.error(`Fatura exception (#${order.orderNumber}):`, error);
            }
        }

        toast.dismiss(toastId);
        if (failed === 0) {
            toast.success(`✅ ${success} fatura başarıyla kesildi!`);
        } else {
            toast.warning(`${success} başarılı, ${failed} hatalı fatura.`);
        }
        setSelectedIds([]);
        router.refresh();
    };

    const handleYKSync = async () => {
        setIsSyncingYK(true);
        try {
            const result = await syncAllYKOrders();
            if (result.success) {
                toast.success(result.message);
                router.refresh();
            } else {
                toast.error(result.error);
            }
        } catch (error) {
            toast.error("İşlem sırasında bir hata oluştu");
        } finally {
            setIsSyncingYK(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Bulk Actions Bar */}
            {selectedIds.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-3 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-[#17457C] dark:text-[#17457C]" />
                        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                            {selectedIds.length} sipariş seçildi
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Select onValueChange={handleBulkStatusUpdate} disabled={isBulkLoading}>
                            <SelectTrigger className="w-[200px] h-9 bg-white dark:bg-gray-800">
                                <SelectValue placeholder="Durumu Güncelle" />
                            </SelectTrigger>
                            <SelectContent>
                                {orderStatuses.filter(s => s.value !== 'ALL').map((status) => (
                                    <SelectItem key={status.value} value={status.value}>
                                        {status.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-white dark:bg-gray-800 gap-2 border-orange-200 text-orange-700 hover:bg-orange-50"
                            onClick={handleBulkShippingLabels}
                        >
                            <Truck className="h-4 w-4" />
                            Toplu Etiket
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-white dark:bg-gray-800 gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                            onClick={handleBulkSendYK}
                            disabled={isBulkLoading}
                        >
                            <SendHorizonal className="h-4 w-4" />
                            Toplu YK Gönder
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-white dark:bg-gray-800 gap-2"
                            onClick={handleBulkPrint}
                        >
                            <Printer className="h-4 w-4" />
                            Toplu Yazdır
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-white dark:bg-gray-800 gap-2 border-purple-200 text-purple-700 hover:bg-purple-50"
                            onClick={handleBulkMarkPrinted}
                            disabled={isBulkLoading}
                        >
                            <CheckCircle2 className="h-4 w-4" />
                            Yazdırıldı İşaretle
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-white dark:bg-gray-800 gap-2 border-green-200 text-green-700 hover:bg-green-50"
                            onClick={handleBulkInvoice}
                        >
                            <ReceiptText className="h-4 w-4" />
                            Toplu Fatura
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedIds([])}
                            className="text-[#17457C] hover:text-blue-700 hover:bg-blue-100"
                        >
                            İptal
                        </Button>
                    </div>
                </div>
            )}

            {/* Filter Bar */}
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow border border-gray-100 dark:border-gray-800">
                <div className="flex flex-col md:flex-row md:items-end gap-4">
                    {/* Search */}
                    <div className="flex-1 min-w-[200px] space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Arama</label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Sipariş No, Müşteri Adı..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                                className="pl-9"
                            />
                        </div>
                    </div>

                    {/* Status */}
                    <div className="w-full md:w-[160px] space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Durum</label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Tümü" />
                            </SelectTrigger>
                            <SelectContent>
                                {orderStatuses.map((status) => (
                                    <SelectItem key={status.value} value={status.value}>
                                        {status.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Cargo Filter */}
                    <div className="w-full md:w-[140px] space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Kargo</label>
                        <Select value={cargoFilter} onValueChange={setCargoFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Tümü" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Tümü</SelectItem>
                                <SelectItem value="YURTICI">Yurtiçi Kargo</SelectItem>
                                <SelectItem value="ARAS">Aras Kargo</SelectItem>
                                <SelectItem value="OTHER">Diğer</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Source Filter */}
                    <div className="w-full md:w-[140px] space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Kaynak</label>
                        <Select value={sourceFilter} onValueChange={setSourceFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Tümü" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Tümü</SelectItem>
                                <SelectItem value="WEB">Web Sitesi</SelectItem>
                                <SelectItem value="TRENDYOL">Trendyol</SelectItem>
                                <SelectItem value="N11">N11</SelectItem>
                                <SelectItem value="HEPSIBURADA">Hepsiburada</SelectItem>
                                <SelectItem value="IDEFIX">Idefix</SelectItem>
                                <SelectItem value="PAZARAMA">Pazarama</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Invoice Filter */}
                    <div className="w-full md:w-[140px] space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Fatura</label>
                        <Select value={invoiceFilter} onValueChange={setInvoiceFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Tümü" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Tümü</SelectItem>
                                <SelectItem value="SENT">✅ Kesildi</SelectItem>
                                <SelectItem value="NONE">⏳ Kesilmedi</SelectItem>
                                <SelectItem value="ERROR">❌ Hatalı</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Printed Filter */}
                    <div className="w-full md:w-[140px] space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Yazdırma</label>
                        <Select value={printedFilter} onValueChange={setPrintedFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Tümü" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Tümü</SelectItem>
                                <SelectItem value="NO">🖨️ Yazdırılmadı</SelectItem>
                                <SelectItem value="YES">✅ Yazdırıldı</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Date Range */}
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="space-y-2 flex-1 md:w-[140px]">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Başlangıç</label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="pt-8 text-gray-400">-</div>
                        <div className="space-y-2 flex-1 md:w-[140px]">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Bitiş</label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-end gap-2 md:ml-auto w-full md:w-auto pt-2 md:pt-0">
                        <Button 
                            onClick={handleYKSync} 
                            disabled={isSyncingYK}
                            variant="outline" 
                            className="text-[#17457C] border-blue-200 hover:bg-blue-50 gap-2 shrink-0"
                            title="Yolda olan Yurtiçi Kargo durumlarını son 14 güne göre güncelle"
                        >
                            <RefreshCw className={`h-4 w-4 ${isSyncingYK ? "animate-spin" : ""}`} />
                            <span className="hidden sm:inline">Kargoları Güncelle</span>
                        </Button>
                        <Button onClick={resetFilters} variant="ghost" className="text-gray-500 hover:text-gray-700">
                            Temizle
                        </Button>
                        <Button onClick={applyFilters} className="min-w-[100px]">
                            Filtrele
                        </Button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">
                                    <Checkbox
                                        checked={selectedIds.length === orders.length && orders.length > 0}
                                        onCheckedChange={toggleSelectAll}
                                        aria-label="Tümünü Seç"
                                    />
                                </TableHead>
                                <TableHead>Sipariş No</TableHead>
                                <TableHead>Müşteri</TableHead>
                                <TableHead>Tarih</TableHead>
                                <TableHead>Tutar</TableHead>
                                <TableHead>Kargo</TableHead>
                                <TableHead>Durum</TableHead>
                                <TableHead className="text-right">İşlemler</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {orders.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                                        Sipariş bulunamadı.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                orders.map((order) => (
                                    <TableRow
                                        key={order.id}
                                        className={`cursor-pointer transition-colors ${selectedIds.includes(order.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-muted/50'}`}
                                        onClick={() => {
                                            setSelectedOrder(order);
                                            setIsOpen(true);
                                        }}
                                    >
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                checked={selectedIds.includes(order.id)}
                                                onCheckedChange={() => toggleSelect(order.id)}
                                                aria-label={`${order.orderNumber} nolu siparişi seç`}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                {order.source === "TRENDYOL" && (
                                                    <Badge className="bg-[#f27a1a] hover:bg-[#ef6c00] text-white border-none px-1.5 py-0 text-[10px] font-bold">
                                                        TRENDYOL
                                                    </Badge>
                                                )}
                                                {order.source === "N11" && (
                                                    <Badge className="bg-[#5c3dbc] hover:bg-[#4a2fac] text-white border-none px-1.5 py-0 text-[10px] font-bold">
                                                        N11
                                                    </Badge>
                                                )}
                                                {order.source === "HEPSIBURADA" && (
                                                    <Badge className="bg-[#ff6000] hover:bg-[#e05300] text-white border-none px-1.5 py-0 text-[10px] font-bold">
                                                        HEPSİBURADA
                                                    </Badge>
                                                )}
                                                {order.source === "IDEFIX" && (
                                                    <Badge className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white border-none px-1.5 py-0 text-[10px] font-bold">
                                                        IDEFIX
                                                    </Badge>
                                                )}
                                                {order.source === "PAZARAMA" && (
                                                    <Badge className="bg-[#d8005f] hover:bg-[#b0004e] text-white border-none px-1.5 py-0 text-[10px] font-bold">
                                                        PAZARAMA
                                                    </Badge>
                                                )}
                                                {(order.source === "WEB" || !order.source) && (
                                                    <Badge variant="outline" className="text-gray-500 border-gray-200 px-1.5 py-0.5 text-[10px] font-bold uppercase">
                                                        WEB
                                                    </Badge>
                                                )}
                                                <span>#{order.orderNumber}</span>
                                                {(order as any).isPrinted && (
                                                    <span title="Yazdırıldı" className="text-green-500">
                                                        <Printer className="h-3 w-3" />
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">
                                                    {order.shippingAddress?.fullName || (order.shippingAddress as any)?.name || (order.user as any)?.name || order.user?.companyName || order.user?.email || order.guestEmail || "Misafir"}
                                                </span>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    {order.cargoCompany && (
                                                        <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded flex items-center gap-1 uppercase font-bold tracking-tight">
                                                            <Truck className="h-2.5 w-2.5" />
                                                            {order.cargoCompany}
                                                        </span>
                                                    )}
                                                    {(() => {
                                                        const phone = order.user?.phone || (order.shippingAddress as any)?.phone;
                                                        return phone ? (
                                                            <a
                                                                href={`https://wa.me/${phone.replace(/\D/g, "").replace(/^0/, "90").replace(/^5/, "905")}?text=${encodeURIComponent(`Merhaba Bardakcı Bike'tan #${order.orderNumber} numaralı siparişiniz için yazıyorum`)}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-green-500 hover:text-green-600 flex items-center gap-0.5 text-[10px]"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <MessageCircle className="h-2.5 w-2.5" />
                                                                WhatsApp
                                                            </a>
                                                        ) : null;
                                                    })()}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs text-gray-500" suppressHydrationWarning>{formatDate(order.createdAt)}</TableCell>
                                        <TableCell className="font-medium">
                                            <div className="flex flex-col">
                                                <span>{formatPrice(Number(order.total))}</span>
                                                {order.payment && order.payment.method !== "BANK_TRANSFER" && order.payment.amount > 0 && Math.abs(order.payment.amount - Number(order.total)) > 0.5 && (
                                                    <span className="text-[10px] text-[#17457C] font-bold">
                                                        Net: {formatPrice(order.payment.amount)}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {order.cargoTrackingNumber ? (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[10px] text-gray-400 uppercase font-bold">TAKİP NO</span>
                                                    <span className="text-xs font-mono select-all bg-gray-50 dark:bg-gray-800/50 px-1 rounded">{order.cargoTrackingNumber}</span>
                                                </div>
                                            ) : (order as any).invoiceNo ? (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[10px] text-orange-400 uppercase font-bold">FATURA NO</span>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-xs font-mono select-all bg-orange-50 dark:bg-orange-900/20 px-1 rounded">{(order as any).invoiceNo}</span>
                                                        {(order as any).invoiceUrl && (
                                                            <a href={(order as any).invoiceUrl} target="_blank" rel="noopener noreferrer">
                                                                <ExternalLink className="h-3 w-3 text-orange-500" />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            <div className="w-[180px] flex flex-col gap-1">
                                                <Select
                                                    value={order.status}
                                                    onValueChange={(value) => handleStatusChange(order.id, value)}
                                                    disabled={loadingId === order.id}
                                                >
                                                    <SelectTrigger className={`h-8 border-transparent bg-transparent hover:opacity-90 focus:ring-0 ${getOrderStatusColor(order.status)} border shadow-sm [&_svg]:text-white [&_svg]:opacity-100 transition-none`}>
                                                        <SelectValue>
                                                            {getOrderStatusLabel(order.status, order.payment?.method)}
                                                        </SelectValue>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {orderStatuses.filter(s => s.value !== 'ALL').map((status) => (
                                                            <SelectItem key={status.value} value={status.value}>
                                                                {status.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {order.payment?.method && (
                                                    <span className="text-[10px] text-gray-500 font-medium">
                                                        {order.payment.method === "BANK_TRANSFER" ? "Havale / EFT" : "Kredi Kartı"}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex justify-end gap-2">
                                                <div className="flex gap-1">
                                                    {(order.source === "TRENDYOL" || order.source === "N11" || order.source === "HEPSIBURADA" || order.source === "IDEFIX") && (
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="border-blue-200 text-[#17457C] hover:bg-blue-50 h-9 w-9"
                                                            title="Sistem Barkodu (Hızlı)"
                                                            onClick={() => window.open(`/admin/orders/bulk-shipping-labels?ids=${order.id}`, '_blank')}
                                                        >
                                                            <Barcode className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {!(order as any).invoiceNo ? (
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="border-orange-200 text-orange-600 hover:bg-orange-50 h-9 w-9"
                                                            title="E-Fatura Gönder"
                                                            disabled={loadingId === order.id}
                                                            onClick={() => handleSendInvoice(order.id)}
                                                        >
                                                            <ReceiptText className="h-5 w-5" />
                                                        </Button>
                                                    ) : (order.source === "HEPSIBURADA" || order.source === "N11" || order.source === "IDEFIX") && (
                                                         <Button
                                                             variant="outline"
                                                             size="icon"
                                                             className="border-orange-300 bg-orange-50/50 text-orange-600 hover:bg-orange-100 h-9 w-9"
                                                             title="Pazaryeri Faturasını Güncelle / Yeniden Gönder"
                                                             disabled={loadingId === order.id}
                                                             onClick={() => handleSendInvoice(order.id)}
                                                         >
                                                             <RefreshCw className={`h-4 w-4 text-orange-600 ${loadingId === order.id ? 'animate-spin' : ''}`} />
                                                         </Button>
                                                     )}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Siparişi Yazdır"
                                                    className="h-9 w-9"
                                                    onClick={async () => {
                                                        window.open(`/admin/orders/${order.id}/print`, '_blank');
                                                        if (!(order as any).isPrinted) {
                                                            try {
                                                                await markOrderAsPrinted(order.id);
                                                                setOrders(prev => prev.map(o =>
                                                                    o.id === order.id ? { ...o, isPrinted: true } : o
                                                                ));
                                                            } catch (e) {
                                                                console.error(e);
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <FileDown className="h-5 w-5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-9 w-9"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedOrder(order);
                                                        setIsOpen(true);
                                                    }}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination Controls */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t">
                        <div className="text-sm text-gray-500">
                            Toplam {pagination.totalCount} sipariş, Sayfa {pagination.currentPage} / {pagination.totalPages}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(pagination.currentPage - 1)}
                                disabled={pagination.currentPage <= 1}
                            >
                                Önceki
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(pagination.currentPage + 1)}
                                disabled={pagination.currentPage >= pagination.totalPages}
                            >
                                Sonraki
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Order Detail Dialog */}
            <Dialog open={isOpen} onOpenChange={handleOpenChange}>
                <DialogContent className="!max-w-none w-[95vw] sm:w-[90vw] xl:!w-[1250px] max-h-[92vh] overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800 scrollbar-track-transparent p-0">
                    <DialogHeader className="px-10 pt-10 border-b pb-6 mb-6">
                        <div className="flex flex-row items-center justify-between">
                            <DialogTitle className="text-xl flex items-center gap-4">
                                Sipariş Detayı - {selectedOrder?.orderNumber}
                                {selectedOrder && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="hidden md:flex gap-2 shrink-0 border-orange-200 text-orange-700 hover:bg-orange-50"
                                        onClick={() => window.open(`/admin/orders/${selectedOrder.id}/print`, '_blank')}
                                    >
                                        <Printer className="h-4 w-4" />
                                        Siparişi Yazdır
                                    </Button>
                                )}
                            </DialogTitle>
                            {/* Mobile only print button or just let it be hidden if not needed */}
                            {selectedOrder && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="md:hidden gap-2 shrink-0 border-orange-200 text-orange-700 mr-8"
                                    onClick={() => window.open(`/admin/orders/${selectedOrder.id}/print`, '_blank')}
                                >
                                    <Printer className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </DialogHeader>
                    {selectedOrder && (
                        <div className="space-y-6 pl-10 pr-12 pb-10">
                            {/* Top Grid: Customer, Address, Cargo/Status - 3 Columns */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {/* Column 1: Customer Info */}
                                <div className="space-y-4">
                                    <div>
                                        <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
                                            <span className="bg-blue-100 text-blue-700 p-1 rounded">👤</span> Müşteri Bilgileri
                                        </h4>
                                        <div className="text-sm space-y-1 text-gray-600 dark:text-gray-300 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                                            <p className="font-medium text-gray-900 dark:text-gray-100">
                                                {selectedOrder.shippingAddress?.fullName || (selectedOrder.shippingAddress as any)?.name || selectedOrder.user?.companyName || selectedOrder.user?.email || selectedOrder.guestEmail || "Misafir"}
                                            </p>
                                            <p>{selectedOrder.user?.email || selectedOrder.guestEmail}</p>
                                            <p>{selectedOrder.user?.phone || "-"}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold mb-2 text-sm">Sipariş Notu</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 italic bg-yellow-50 p-2 rounded border border-yellow-100">
                                            {selectedOrder.notes || "Not yok."}
                                        </p>
                                    </div>
                                </div>

                                {/* Column 2: Shipping Address */}
                                <div>
                                    <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
                                        <span className="bg-green-100 text-green-700 p-1 rounded">📍</span> Teslimat Adresi
                                    </h4>
                                    <div className="text-sm text-gray-600 dark:text-gray-300 p-3 bg-gray-50 dark:bg-gray-800 rounded-md h-[calc(100%-32px)]">
                                        {selectedOrder.shippingAddress ? (
                                            <>
                                                <p className="font-bold text-gray-900 dark:text-gray-100 mb-1">{(selectedOrder.shippingAddress as any).title}</p>
                                                <p>{(selectedOrder.shippingAddress as any).address}</p>
                                                <p className="mt-1 font-medium">{(selectedOrder.shippingAddress as any).district} / {(selectedOrder.shippingAddress as any).city}</p>
                                                <p className="mt-1 text-gray-500">Tel: {(selectedOrder.shippingAddress as any).phone}</p>
                                            </>
                                        ) : (
                                            <p className="text-red-500">Adres bilgisi bulunamadı.</p>
                                        )}
                                    </div>
                                </div>

                                {/* Column 3: Cargo & Status */}
                                <div className="space-y-4">
                                    <div>
                                        <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
                                            <span className="bg-purple-100 text-purple-700 p-1 rounded">🚚</span> Kargo Bilgileri
                                        </h4>
                                        <div className="text-sm text-gray-600 dark:text-gray-300 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs text-gray-500">Firma</span>
                                                <span className="font-medium">{selectedOrder.cargoCompany || "Seçilmedi"}</span>
                                            </div>
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs text-gray-500">Desi</span>
                                                <span className="font-medium">{(selectedOrder as any).shippingDesi || 0}</span>
                                            </div>

                                            <Label className="text-xs font-medium mb-1.5 block">Takip Linki</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    defaultValue={selectedOrder.trackingUrl || ""}
                                                    placeholder="https://..."
                                                    className="h-7 text-xs"
                                                    id={`tracking-${selectedOrder.id}`}
                                                />
                                                <Button
                                                    size="sm"
                                                    className="h-7 px-2 text-xs"
                                                    onClick={async () => {
                                                        const input = document.getElementById(`tracking-${selectedOrder.id}`) as HTMLInputElement;
                                                        if (!input) return;

                                                        const result = await updateOrderTracking(selectedOrder.id, input.value);
                                                        if (result.success) {
                                                            toast.success("Takip linki güncellendi");
                                                            setSelectedOrder(prev => prev ? ({ ...prev, trackingUrl: input.value }) : null);
                                                            setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, trackingUrl: input.value } : o));
                                                        } else {
                                                            toast.error(result.error);
                                                        }
                                                    }}
                                                >
                                                    Kaydet
                                                </Button>
                                            </div>
                                            {selectedOrder.trackingUrl && (
                                                <a href={selectedOrder.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#17457C] hover:underline mt-1.5 inline-flex items-center gap-1">
                                                    Kargo Takip ↗
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-medium text-blue-900">Sipariş Durumu</span>
                                            <Badge className={`${getOrderStatusColor(selectedOrder.status)}`}>
                                                {getOrderStatusLabel(selectedOrder.status)}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Kredi Kartı İşlemleri */}
                            {selectedOrder.payment?.method === "CREDIT_CARD" && selectedOrder.payment?.providerData && (
                                <div className="border border-purple-100 dark:border-purple-800 rounded-lg overflow-hidden">
                                    <div className="bg-purple-50 dark:bg-purple-900/20 px-4 py-2.5 border-b border-purple-100 dark:border-purple-800">
                                        <h4 className="font-semibold text-sm flex items-center gap-2 text-purple-900 dark:text-purple-200">
                                            <span className="bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300 p-1 rounded">💳</span>
                                            Kredi Kartı İşlemleri
                                        </h4>
                                    </div>
                                    <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                                        <div>
                                            <span className="text-xs text-gray-500 block">İşlem Durumu</span>
                                            <span className={`font-medium ${selectedOrder.payment.providerData.status === "success" ? "text-green-600" : "text-red-600"}`}>
                                                {selectedOrder.payment.providerData.status === "success" ? "✅ Başarılı" : "❌ Başarısız"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-xs text-gray-500 block">Sanal Pos</span>
                                            <span className="font-medium">PayTR</span>
                                        </div>
                                        <div>
                                            <span className="text-xs text-gray-500 block">Ödenen Tutar</span>
                                            <span className="font-medium">{formatPrice(selectedOrder.payment.amount)}</span>
                                        </div>
                                        {selectedOrder.payment.providerData.installment_count && (
                                            <div>
                                                <span className="text-xs text-gray-500 block">Taksit</span>
                                                <span className="font-medium">
                                                    {Number(selectedOrder.payment.providerData.installment_count) > 1
                                                        ? `${selectedOrder.payment.providerData.installment_count} Taksit`
                                                        : "Tek Çekim"}
                                                </span>
                                            </div>
                                        )}
                                        {selectedOrder.payment.providerData.payment_type && (
                                            <div>
                                                <span className="text-xs text-gray-500 block">Kart Tipi</span>
                                                <span className="font-medium">{selectedOrder.payment.providerData.payment_type}</span>
                                            </div>
                                        )}
                                        {(selectedOrder.payment as any).providerRef && (
                                            <div>
                                                <span className="text-xs text-gray-500 block">İşlem Referansı</span>
                                                <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded select-all">
                                                    {(selectedOrder.payment as any).providerRef}
                                                </span>
                                            </div>
                                        )}
                                        {selectedOrder.payment.providerData.hash && (
                                            <div className="col-span-2 md:col-span-3">
                                                <span className="text-xs text-gray-500 block">Hash</span>
                                                <span className="font-mono text-xs text-gray-400 break-all select-all">
                                                    {selectedOrder.payment.providerData.hash}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {/* Yurtiçi Kargo Entegrasyon Bölümü */}
                            <YurticiKargoPanel
                                order={selectedOrder}
                                onUpdate={(updatedFields) => {
                                    setSelectedOrder(prev => prev ? { ...prev, ...updatedFields } as any : null);
                                    setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, ...updatedFields } as any : o));
                                }}
                            />

                            {/* Order Items Table - Compact */}
                            <div>
                                <h4 className="font-semibold mb-2 text-sm">Ürünler ({selectedOrder.items.length})</h4>
                                <div className="border rounded-md overflow-hidden max-h-[300px] overflow-y-auto overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800 scrollbar-track-transparent">
                                    <Table>
                                        <TableHeader className="bg-gray-50 sticky top-0">
                                            <TableRow>
                                                <TableHead className="py-2 h-9 w-14">Görsel</TableHead>
                                                <TableHead className="py-2 h-9">Ürün</TableHead>
                                                <TableHead className="py-2 h-9 text-center w-20">Adet</TableHead>
                                                <TableHead className="py-2 h-9 text-right w-32">Birim Fiyat</TableHead>
                                                <TableHead className="py-2 h-9 text-right w-32">Toplam</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedOrder.items.map((item) => (
                                                <TableRow key={item.id} className="hover:bg-gray-50">
                                                    <TableCell className="py-2">
                                                        {item.product?.images?.[0] ? (
                                                            <img
                                                                src={item.product.images[0]}
                                                                alt={item.productName}
                                                                className="w-10 h-10 object-cover rounded border border-gray-200 cursor-zoom-in hover:opacity-80 transition-opacity"
                                                                onClick={() => setLightboxImage(item.product!.images[0])}
                                                            />
                                                        ) : (
                                                            <div className="w-10 h-10 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-gray-400 text-xs">-</div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <div className="flex flex-col gap-1.5">
                                                            <span className="font-medium text-gray-900 dark:text-gray-100 max-w-[550px] inline-block">{item.productName}</span>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                {item.product?.sku && (
                                                                    <span className="text-xs text-gray-500 font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">SKU: {item.product.sku}</span>
                                                                )}
                                                                {item.product && (
                                                                    <>
                                                                        <a
                                                                            href={`/products/${item.product.slug}`}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-[10px] text-[#17457C] dark:text-[#17457C] hover:text-blue-800 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-1.5 py-0.5 rounded transition-colors inline-flex items-center gap-1 border border-blue-100 dark:border-blue-800"
                                                                            title="Sitede Görüntüle"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            <ExternalLink className="h-3 w-3" /> Ürüne Git
                                                                        </a>
                                                                        <a
                                                                            href={`/admin/products/${item.productId}/edit`}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-[10px] text-orange-600 dark:text-orange-400 hover:text-orange-800 bg-orange-50 dark:bg-orange-900/30 hover:bg-orange-100 dark:hover:bg-orange-900/50 px-1.5 py-0.5 rounded transition-colors inline-flex items-center gap-1 border border-orange-100 dark:border-orange-800"
                                                                            title="Ürün Fiyat / Bilgi Güncelle"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            <Pencil className="h-3 w-3" /> Fiyat Güncelle
                                                                        </a>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-center font-medium">
                                                        {item.quantity}
                                                    </TableCell>
                                                    <TableCell className="py-2 text-right text-gray-600">
                                                        {formatPrice(Number(item.unitPrice))}
                                                    </TableCell>
                                                    <TableCell className="py-2 text-right font-medium">
                                                        {formatPrice(Number(item.lineTotal))}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>

                            {/* Totals */}
                            <div className="flex justify-end pt-2 border-t">
                                <div className="w-72 space-y-1.5 bg-gray-50 p-4 rounded-lg">
                                    <div className="flex justify-between text-sm text-gray-600">
                                        <span>Ara Toplam</span>
                                        <span>{formatPrice(Number(selectedOrder.subtotal))}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-gray-600">
                                        <span>KDV Toplam</span>
                                        <span>{formatPrice(Number(selectedOrder.vatAmount))}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-gray-600">
                                        <span>Kargo Ücreti</span>
                                        <span>{formatPrice(Number((selectedOrder as any).shippingCost || 0))}</span>
                                    </div>
                                    <div className="border-t border-gray-200 my-1"></div>
                                    <div className="flex justify-between text-lg font-bold text-gray-900">
                                        <span>Genel Toplam</span>
                                        <span>{formatPrice(Number(selectedOrder.total))}</span>
                                    </div>
                                    {selectedOrder.payment && selectedOrder.payment.amount > 0 && Math.abs(selectedOrder.payment.amount - Number(selectedOrder.total)) > 0.5 && (
                                        <div className="flex justify-between text-sm font-bold text-[#17457C] mt-2 pt-2 border-t border-blue-200">
                                            <div className="flex flex-col">
                                                <span>Alınan Net Ödeme</span>
                                                {selectedOrder.payment.providerData?.installment_count && Number(selectedOrder.payment.providerData.installment_count) > 1 && (
                                                    <span className="text-[10px] font-normal italic">
                                                        ({selectedOrder.payment.providerData.installment_count} Taksit / Vade Farkı Dahil)
                                                    </span>
                                                )}
                                            </div>
                                            <span>{formatPrice(selectedOrder.payment.amount)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Lightbox */}
            <Dialog open={!!lightboxImage} onOpenChange={(open) => !open && setLightboxImage(null)}>
                <DialogContent 
                    className="max-w-screen-xl bg-transparent border-none shadow-none flex flex-col items-center justify-center pointer-events-none p-0" 
                    showCloseButton={false}
                >
                    <div className="relative w-full h-full flex items-center justify-center pointer-events-auto">
                        <button
                            className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors z-50"
                            onClick={() => setLightboxImage(null)}
                        >
                            <X className="h-6 w-6" />
                        </button>
                        <img
                            src={lightboxImage || ""}
                            alt="Ürün Görseli"
                            className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
