"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Package, RefreshCw, XCircle, SendHorizonal, AlertCircle, CheckCircle2 } from "lucide-react";
import { sendOrderToYurtici, cancelYKOrder, queryYKOrder } from "@/app/admin/(protected)/orders/actions";
import { getYKStatusLabel, getYKStatusColor } from "@/services/yurtici/api";

interface YKOrder {
    id: string;
    orderNumber: string;
    ykCargoKey: string | null;
    ykJobId: number | null;
    ykDocId: string | null;
    ykStatus: string | null;
    ykStatusMessage: string | null;
    ykError: string | null;
    ykSyncedAt: Date | string | null;
    trackingUrl: string | null;
    status: string;
}

interface YurticiKargoPanelProps {
    order: YKOrder & Record<string, any>;
    onUpdate: (fields: Partial<YKOrder>) => void;
}

export function YurticiKargoPanel({ order, onUpdate }: YurticiKargoPanelProps) {
    const [isSending, setIsSending] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [isQuerying, setIsQuerying] = useState(false);

    const hasSentToYK = !!(order as any).ykCargoKey;
    const ykStatus = (order as any).ykStatus as string | null | undefined;
    const ykJobId = (order as any).ykJobId as number | null | undefined;
    const ykDocId = (order as any).ykDocId as string | null | undefined;
    const ykError = (order as any).ykError as string | null | undefined;
    const ykStatusMessage = (order as any).ykStatusMessage as string | null | undefined;
    const ykCargoKey = (order as any).ykCargoKey as string | null | undefined;
    const ykSyncedAt = (order as any).ykSyncedAt as Date | string | null | undefined;

    const handleSend = async () => {
        setIsSending(true);
        try {
            const result = await sendOrderToYurtici(order.id);
            if (result.success) {
                toast.success(
                    result.isTestMode
                        ? `✅ YK Test Ortamına gönderildi. Job ID: ${result.jobId}`
                        : `✅ YK'ya gönderildi. Job ID: ${result.jobId}`
                );
                onUpdate({
                    ykCargoKey: result.cargoKey,
                    ykJobId: result.jobId,
                    ykStatus: "NOP",
                    ykError: null,
                });
            } else {
                toast.error(result.error || "YK'ya gönderilemedi.");
            }
        } finally {
            setIsSending(false);
        }
    };

    const handleQuery = async () => {
        setIsQuerying(true);
        try {
            const result = await queryYKOrder(order.id);
            if (result.success) {
                toast.success(`Kargo durumu güncellendi: ${result.operationMessage}`);
                onUpdate({
                    ykStatus: result.operationStatus,
                    ykStatusMessage: result.operationMessage,
                    ykDocId: result.docId,
                    ykSyncedAt: new Date(),
                    trackingUrl: result.trackingUrl,
                    status: result.operationStatus === "IND" ? "SHIPPED" : 
                            result.operationStatus === "DLV" ? "DELIVERED" : 
                            (result.operationStatus === "CNL" || result.operationStatus === "ISC" || result.operationStatus === "BI") ? "CANCELLED" : undefined,
                });
            } else {
                toast.error(result.error || "Sorgu başarısız.");
            }
        } finally {
            setIsQuerying(false);
        }
    };

    const handleCancel = async () => {
        if (!confirm(`#${order.orderNumber} nolu siparişin YK kaydını iptal etmek istediğinize emin misiniz?`)) return;
        setIsCancelling(true);
        try {
            const result = await cancelYKOrder(order.id);
            if (result.success) {
                toast.success(`İptal işlemi: ${result.operationMessage || "Başarılı"}`);
                onUpdate({
                    ykStatus: result.operationStatus,
                    ykStatusMessage: result.operationMessage,
                    ykSyncedAt: new Date(),
                });
            } else {
                toast.error(result.error || "İptal başarısız.");
            }
        } finally {
            setIsCancelling(false);
        }
    };

    return (
        <div className="border border-orange-200 dark:border-orange-800 rounded-lg overflow-hidden">
            {/* Başlık */}
            <div className="bg-orange-50 dark:bg-orange-900/20 px-4 py-2.5 flex items-center justify-between border-b border-orange-200 dark:border-orange-800">
                <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    <span className="text-sm font-semibold text-orange-900 dark:text-orange-100">
                        Yurtiçi Kargo
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {ykStatus && (
                        <Badge className={`text-xs ${getYKStatusColor(ykStatus)}`}>
                            {getYKStatusLabel(ykStatus)}
                        </Badge>
                    )}
                    {!hasSentToYK && (
                        <Badge variant="outline" className="text-xs text-gray-500">
                            Gönderilmedi
                        </Badge>
                    )}
                </div>
            </div>

            <div className="p-4 space-y-3">
                {/* Durum bilgisi */}
                {hasSentToYK ? (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-gray-600 dark:text-gray-300">
                        <div className="flex items-center gap-1.5">
                            <span className="text-gray-400">Kargo Anahtarı:</span>
                            <span className="font-mono font-medium">{ykCargoKey}</span>
                        </div>
                        {ykJobId && (
                            <div className="flex items-center gap-1.5">
                                <span className="text-gray-400">Job ID:</span>
                                <span className="font-mono font-medium">{ykJobId}</span>
                            </div>
                        )}
                        {ykDocId && (
                            <div className="flex items-center gap-1.5">
                                <span className="text-gray-400">Gönderi No:</span>
                                <span className="font-mono font-medium">{ykDocId}</span>
                            </div>
                        )}
                        {ykStatusMessage && (
                            <div className="col-span-2 flex items-center gap-1.5">
                                <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                                <span>{ykStatusMessage}</span>
                            </div>
                        )}
                        {ykSyncedAt && (
                            <div className="col-span-2 text-gray-400 text-[10px]">
                                Son güncelleme: {new Date(ykSyncedAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Bu sipariş henüz Yurtiçi Kargo sistemine gönderilmemiştir.
                        Göndermek için aşağıdaki butonu kullanın.
                    </p>
                )}

                {/* Hata bilgisi */}
                {ykError && (
                    <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2.5 rounded-md border border-red-200 dark:border-red-800">
                        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>{ykError}</span>
                    </div>
                )}

                {/* Butonlar */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                    {!hasSentToYK ? (
                        <Button
                            size="sm"
                            className="h-8 gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs"
                            onClick={handleSend}
                            disabled={isSending}
                            id={`yk-send-${order.id}`}
                        >
                            <SendHorizonal className="h-3.5 w-3.5" />
                            {isSending ? "Gönderiliyor..." : "YK'ya Gönder"}
                        </Button>
                    ) : (
                        <>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1.5 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                                onClick={handleQuery}
                                disabled={isQuerying}
                                id={`yk-query-${order.id}`}
                            >
                                <RefreshCw className={`h-3.5 w-3.5 ${isQuerying ? "animate-spin" : ""}`} />
                                {isQuerying ? "Sorgulanıyor..." : "Durumu Sorgula"}
                            </Button>

                            {/* İptal: yalnızca CNL, ISC, DLV değilse göster */}
                            {ykStatus !== "CNL" && ykStatus !== "ISC" && ykStatus !== "DLV" && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 gap-1.5 text-xs border-red-200 text-red-600 hover:bg-red-50"
                                    onClick={handleCancel}
                                    disabled={isCancelling}
                                    id={`yk-cancel-${order.id}`}
                                >
                                    <XCircle className="h-3.5 w-3.5" />
                                    {isCancelling ? "İptal Ediliyor..." : "YK'da İptal Et"}
                                </Button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
