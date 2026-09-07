"use client";

import { useState } from "react";
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import Image from "next/image";
import Link from "next/link";
import { syncBatchStatuses } from "../actions";
import { toast } from "sonner";

interface BatchItem {
    id: string;
    productId: string;
    productName: string;
    image: string;
    barcode: string;
    batchRequestId: string;
    batchStatus: string;
    isSynced: boolean;
    lastSyncError: string | null;
    lastSyncedAt: string;
}

export function TrendyolBatchList({ initialData }: { initialData: BatchItem[] }) {
    const [data, setData] = useState<BatchItem[]>(initialData);
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSyncStatuses = async () => {
        setIsSyncing(true);
        try {
            const res = await syncBatchStatuses();
            if (res.success) {
                toast.success(res.message);
                // Reload the page to get the freshest data
                window.location.reload();
            } else {
                toast.error(res.message);
            }
        } catch (e: any) {
            toast.error("Güncelleme başarısız: " + e.message);
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/admin/integrations/trendyol">
                        <Button variant="outline" size="icon">
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Trendyol İşlem (Batch) Geçmişi</h1>
                        <p className="text-sm text-muted-foreground">Trendyol'a gönderilen ürünlerin asenkron işlem sonuçlarını izleyin.</p>
                    </div>
                </div>
                <Button 
                    onClick={handleSyncStatuses} 
                    disabled={isSyncing}
                    className="gap-2 bg-[#F27A1A] hover:bg-[#F27A1A]/90 text-white"
                >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                    {isSyncing ? "Durumlar Sorgulanıyor..." : "Durumları Güncelle"}
                </Button>
            </div>

            <div className="rounded-md border bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-gray-50/50 dark:bg-gray-800/50">
                        <TableRow>
                            <TableHead>Ürün</TableHead>
                            <TableHead>Barkod</TableHead>
                            <TableHead>Batch ID</TableHead>
                            <TableHead>Durum</TableHead>
                            <TableHead>Sonuç / Hata</TableHead>
                            <TableHead className="text-right">Tarih</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                    <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                    <p>Henüz Trendyol'a gönderilmiş bir ürün bulunamadı.</p>
                                </TableCell>
                            </TableRow>
                        )}
                        {data.map((item) => (
                            <TableRow key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <div className="relative w-10 h-10 rounded-md border bg-white overflow-hidden shrink-0">
                                            {item.image ? (
                                                <Image src={item.image} alt={item.productName} fill className="object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                                    <span className="text-xs text-gray-400">Görsel Yok</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="font-medium max-w-[200px] truncate" title={item.productName}>
                                            {item.productName}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="font-mono text-xs">{item.barcode}</TableCell>
                                <TableCell className="font-mono text-xs text-gray-500">
                                    <span className="truncate w-32 inline-block" title={item.batchRequestId}>
                                        {item.batchRequestId}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    {(item.batchStatus === "PROCESSING" || item.batchStatus === "IN_PROGRESS") && (
                                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                            <Clock className="w-3 h-3 mr-1" /> İşleniyor
                                        </Badge>
                                    )}
                                    {(item.batchStatus === "COMPLETED" || item.batchStatus === "SUCCESS") && item.isSynced && (
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                            <CheckCircle2 className="w-3 h-3 mr-1" /> Başarılı
                                        </Badge>
                                    )}
                                    {item.batchStatus === "FAILED" || ((item.batchStatus === "COMPLETED" || item.batchStatus === "SUCCESS") && !item.isSynced) ? (
                                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                            <XCircle className="w-3 h-3 mr-1" /> Hatalı
                                        </Badge>
                                    ) : null}
                                    {!["PROCESSING", "IN_PROGRESS", "COMPLETED", "SUCCESS", "FAILED"].includes(item.batchStatus) && (
                                        <Badge variant="outline">{item.batchStatus}</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="max-w-[300px]">
                                    {item.lastSyncError ? (
                                        <div className="text-xs text-red-600 bg-red-50 p-2 rounded-md font-medium whitespace-pre-wrap">
                                            {item.lastSyncError}
                                        </div>
                                    ) : item.batchStatus === "PROCESSING" || item.batchStatus === "IN_PROGRESS" ? (
                                        <span className="text-xs text-amber-600 font-medium">Güncelleme işleniyor, lütfen bekleyin...</span>
                                    ) : item.isSynced ? (
                                        <span className="text-xs text-green-600 font-medium">Trendyol panelinde listelendi.</span>
                                    ) : (
                                        <span className="text-xs text-yellow-600">Trendyol ekibi tarafından onay süreci devam ediyor...</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground">
                                    {item.lastSyncedAt ? format(new Date(item.lastSyncedAt), "d MMM yyyy HH:mm", { locale: tr }) : "-"}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
