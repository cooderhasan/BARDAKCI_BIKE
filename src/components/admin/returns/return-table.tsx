"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { Check, X, Loader2, MessageSquare, Archive, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updateReturnRequestStatus } from "@/app/actions/return";
import { toast } from "sonner";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ReturnRequest {
    id: string;
    status: "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";
    createdAt: Date;
    reason: string;
    details: string | null;
    adminNote: string | null;
    user: {
        companyName: string | null;
        email: string | null;
        phone: string | null;
    };
    order: {
        orderNumber: string;
        createdAt: Date;
    };
    orderItem: {
        productName: string;
        quantity: number;
        unitPrice: any; // Decimal
        variantInfo: string | null;
    };
}

interface ReturnTableProps {
    initialRequests: ReturnRequest[];
}

export function ReturnTable({ initialRequests }: ReturnTableProps) {
    const [requests, setRequests] = useState(initialRequests);
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [selectedRequest, setSelectedRequest] = useState<ReturnRequest | null>(null);
    const [note, setNote] = useState("");
    const [actionStatus, setActionStatus] = useState<"APPROVED" | "REJECTED" | "COMPLETED" | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    const openActionDialog = (request: ReturnRequest, status: "APPROVED" | "REJECTED" | "COMPLETED") => {
        setSelectedRequest(request);
        setActionStatus(status);
        setNote(request.adminNote || "");
        setDialogOpen(true);
    };

    const handleUpdate = async () => {
        if (!selectedRequest || !actionStatus) return;

        setLoadingId(selectedRequest.id);
        const result = await updateReturnRequestStatus(selectedRequest.id, actionStatus, note);

        if (result.success) {
            toast.success(`Talep durumu güncellendi: ${actionStatus}`);
            setRequests(requests.map(r => r.id === selectedRequest.id ? { ...r, status: actionStatus, adminNote: note } : r));
            setDialogOpen(false);
        } else {
            toast.error(result.error || "İşlem başarısız.");
        }
        setLoadingId(null);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "PENDING":
                return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">İnceleniyor</Badge>;
            case "APPROVED":
                return <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">Onaylandı</Badge>;
            case "REJECTED":
                return <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100">Reddedildi</Badge>;
            case "COMPLETED":
                return <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100">Tamamlandı</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 font-medium">
                    <tr>
                        <th className="px-6 py-4">Talep Detayı</th>
                        <th className="px-6 py-4">Müşteri</th>
                        <th className="px-6 py-4">İade Nedeni</th>
                        <th className="px-6 py-4">Durum</th>
                        <th className="px-6 py-4 text-right">İşlemler</th>
                    </tr>
                </thead>
                <tbody className="divide-y text-gray-700 dark:text-gray-300">
                    {requests.map((req) => (
                        <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <td className="px-6 py-4">
                                <div className="font-medium text-gray-900 dark:text-white">
                                    {req.orderItem.productName}
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                    {req.orderItem.quantity} Adet • {req.orderItem.variantInfo || "Standart"}
                                </div>
                                <div className="text-xs text-[#17457C] mt-1">
                                    Sipariş: #{req.order.orderNumber}
                                </div>
                                <div className="text-[10px] text-gray-400 mt-0.5">
                                    {formatDistanceToNow(req.createdAt, { addSuffix: true, locale: tr })}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="font-medium">{req.user.companyName || "İsimsiz"}</div>
                                <div className="text-xs text-gray-500">{req.user.email}</div>
                                <div className="text-xs text-gray-500">{req.user.phone}</div>
                            </td>
                            <td className="px-6 py-4 max-w-[250px]">
                                <div className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                                    {req.reason === "defective" ? "Arızalı/Hasarlı" :
                                        req.reason === "wrong_item" ? "Yanlış Ürün" :
                                            req.reason === "changed_mind" ? "Vazgeçtim" : "Diğer"}
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 line-clamp-2" title={req.details || ""}>
                                    {req.details || "-"}
                                </p>
                                {req.adminNote && (
                                    <div className="mt-2 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded text-gray-600 dark:text-gray-400 italic border border-gray-200 dark:border-gray-700">
                                        <span className="font-semibold not-italic">Admin Notu:</span> {req.adminNote}
                                    </div>
                                )}
                            </td>
                            <td className="px-6 py-4">
                                {getStatusBadge(req.status)}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                            <span className="sr-only">Menü</span>
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>İşlemler</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => openActionDialog(req, "APPROVED")}>
                                            <Check className="mr-2 h-4 w-4 text-green-600" />
                                            Onayla (İade Bekleniyor)
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => openActionDialog(req, "REJECTED")}>
                                            <X className="mr-2 h-4 w-4 text-red-600" />
                                            Reddet
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => openActionDialog(req, "COMPLETED")}>
                                            <Archive className="mr-2 h-4 w-4 text-[#17457C]" />
                                            Tamamla (İade Alındı)
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => alert("Detay sayfası henüz yapılmadı.")}>
                                            Detay Görüntüle
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </td>
                        </tr>
                    ))}
                    {requests.length === 0 && (
                        <tr>
                            <td colSpan={5} className="text-center py-12 text-gray-500">
                                Gösterilecek iade talebi bulunamadı.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Talebi Güncelle: {actionStatus === "APPROVED" ? "Onayla" : actionStatus === "REJECTED" ? "Reddet" : "Tamamla"}</DialogTitle>
                        <DialogDescription>
                            Bu işlem için müşteriye gösterilecek bir not ekleyebilirsiniz.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="note">Admin Notu</Label>
                            <Textarea
                                id="note"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Opsiyonel..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={!!loadingId}>Vazgeç</Button>
                        <Button
                            onClick={handleUpdate}
                            disabled={!!loadingId}
                            variant={actionStatus === "REJECTED" ? "destructive" : "default"}
                        >
                            {loadingId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Güncelle
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
