"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, RefreshCw, XCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface MarketplaceBatchRow {
    id: string;
    productName: string;
    image: string;
    barcode: string;
    batchId: string;
    status: string;
    error: string | null;
    date: string | null;
}

interface MarketplaceBatchListProps {
    marketplace: string;
    backHref: string;
    rows: MarketplaceBatchRow[];
    /** Yoksa düğme çıkmaz (sonucu gönderim anında belli olan pazaryerleri) */
    onRefresh?: () => Promise<{ success: boolean; message: string }>;
}

function StatusBadge({ status, hasError }: { status: string; hasError: boolean }) {
    if (hasError || status === "FAILED") {
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" /> Hatalı</Badge>;
    }
    if (["PENDING", "PROCESSING", "IN_PROGRESS"].includes(status)) {
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" /> İşleniyor</Badge>;
    }
    if (["SUCCESS", "COMPLETED"].includes(status)) {
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" /> Başarılı</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
}

/** Trendyol İşlem Geçmişi ekranının ortak hali (Hepsiburada, Idefix, ePttAVM, Çiçeksepeti, Pazarama) */
export function MarketplaceBatchList({ marketplace, backHref, rows, onRefresh }: MarketplaceBatchListProps) {
    const router = useRouter();
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = async () => {
        if (!onRefresh) return;
        setRefreshing(true);
        try {
            const res = await onRefresh();
            if (res.success) toast.success(res.message);
            else toast.error(res.message);
            router.refresh();
        } catch (e: any) {
            toast.error("Güncelleme başarısız: " + e.message);
        } finally {
            setRefreshing(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                    <Link href={backHref}>
                        <Button variant="outline" size="icon">
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{marketplace} İşlem Geçmişi</h1>
                        <p className="text-sm text-muted-foreground">Son gönderilen 100 ürünün sonucunu izleyin.</p>
                    </div>
                </div>
                {onRefresh && (
                    <Button onClick={handleRefresh} disabled={refreshing} className="gap-2">
                        <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                        {refreshing ? "Durumlar Sorgulanıyor..." : "Durumları Güncelle"}
                    </Button>
                )}
            </div>

            <div className="rounded-md border bg-white dark:bg-gray-900 overflow-x-auto shadow-sm">
                <Table>
                    <TableHeader className="bg-gray-50/50 dark:bg-gray-800/50">
                        <TableRow>
                            <TableHead>Ürün</TableHead>
                            <TableHead>Barkod</TableHead>
                            <TableHead>İşlem No</TableHead>
                            <TableHead>Durum</TableHead>
                            <TableHead>Sonuç / Hata</TableHead>
                            <TableHead className="text-right">Tarih</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                    <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                    <p>Henüz kayıtlı bir gönderim yok.</p>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.map((row) => (
                            <TableRow key={row.id}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <div className="relative w-10 h-10 rounded-md border bg-white overflow-hidden shrink-0">
                                            {row.image ? (
                                                <Image src={row.image} alt={row.productName} fill className="object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-gray-100" />
                                            )}
                                        </div>
                                        <div className="font-medium max-w-[200px] truncate" title={row.productName}>{row.productName}</div>
                                    </div>
                                </TableCell>
                                <TableCell className="font-mono text-xs">{row.barcode || "-"}</TableCell>
                                <TableCell className="font-mono text-xs text-gray-500">
                                    <span className="truncate w-32 inline-block" title={row.batchId}>{row.batchId}</span>
                                </TableCell>
                                <TableCell><StatusBadge status={row.status} hasError={!!row.error} /></TableCell>
                                <TableCell className="max-w-[300px]">
                                    {row.error ? (
                                        <div className="text-xs text-red-600 bg-red-50 p-2 rounded-md font-medium whitespace-pre-wrap">{row.error}</div>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">-</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                                    {row.date ? new Date(row.date).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "short", timeStyle: "short" }) : "-"}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
