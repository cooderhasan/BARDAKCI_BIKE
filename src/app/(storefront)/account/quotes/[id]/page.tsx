"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ArrowLeft, CheckCircle, XCircle, Loader2, Clock } from "lucide-react";
import Link from "next/link";
import { formatPrice } from "@/lib/helpers";
import { toast } from "sonner";

interface QuoteItem {
    id: string;
    productName: string;
    quantity: number;
    listPrice: number;
    quotedPrice: number | null;
    lineTotal: number | null;
}

interface Quote {
    id: string;
    quoteNumber: string;
    status: string;
    notes: string | null;
    subtotal: number | null;
    discount: number | null;
    total: number | null;
    validUntil: string | null;
    createdAt: string;
    items: QuoteItem[];
}

const statusLabels: Record<string, { label: string; color: string }> = {
    PENDING: { label: "Beklemede", color: "bg-yellow-100 text-yellow-800" },
    REVIEWING: { label: "İnceleniyor", color: "bg-blue-100 text-blue-800" },
    QUOTED: { label: "Teklif Geldi", color: "bg-purple-100 text-purple-800" },
    ACCEPTED: { label: "Kabul Edildi", color: "bg-green-100 text-green-800" },
    REJECTED: { label: "Reddedildi", color: "bg-red-100 text-red-800" },
    EXPIRED: { label: "Süresi Doldu", color: "bg-gray-100 text-gray-800" },
    CONVERTED: { label: "Sipariş Oldu", color: "bg-emerald-100 text-emerald-800" },
};

export default function AccountQuoteDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [quote, setQuote] = useState<Quote | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        async function fetchQuote() {
            try {
                const res = await fetch("/api/quotes");
                if (res.ok) {
                    const quotes = await res.json();
                    const found = quotes.find((q: Quote) => q.id === params.id);
                    setQuote(found || null);
                }
            } catch (error) {
                console.error("Fetch quote error:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchQuote();
    }, [params.id]);

    const handleAccept = async () => {
        if (!quote) return;

        setActionLoading(true);
        try {
            const res = await fetch(`/api/quotes/${quote.id}/accept`, {
                method: "POST"
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "İşlem başarısız");
            }

            toast.success("Teklif kabul edildi! Siparişiniz oluşturulacak.");
            router.refresh();
            router.push("/account/quotes");
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (!quote) {
        return (
            <div className="text-center py-12">
                <h2 className="text-xl font-bold">Teklif Bulunamadı</h2>
                <Link href="/account/quotes">
                    <Button className="mt-4">Tekliflerime Dön</Button>
                </Link>
            </div>
        );
    }

    const status = statusLabels[quote.status] || { label: quote.status, color: "bg-gray-100" };
    const canAccept = quote.status === "QUOTED";
    const isExpired = quote.validUntil && new Date(quote.validUntil) < new Date();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Link href="/account/quotes">
                            <Button variant="ghost" size="sm">
                                <ArrowLeft className="h-4 w-4 mr-1" />
                                Geri
                            </Button>
                        </Link>
                        <h2 className="text-2xl font-bold text-gray-900">
                            {quote.quoteNumber}
                        </h2>
                        <Badge className={status.color}>{status.label}</Badge>
                    </div>
                    <p className="text-gray-500">
                        {new Date(quote.createdAt).toLocaleDateString("tr-TR", {
                            day: "numeric",
                            month: "long",
                            year: "numeric"
                        })}
                    </p>
                </div>

                {canAccept && !isExpired && (
                    <Button
                        onClick={handleAccept}
                        disabled={actionLoading}
                        size="lg"
                        className="bg-green-600 hover:bg-green-700"
                    >
                        {actionLoading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <CheckCircle className="h-4 w-4 mr-2" />
                        )}
                        Teklifi Kabul Et
                    </Button>
                )}
            </div>

            {/* Validity Warning */}
            {quote.validUntil && (
                <Card className={isExpired ? "border-red-200 bg-red-50" : "border-blue-200 bg-blue-50"}>
                    <CardContent className="py-4 flex items-center gap-3">
                        <Clock className={`h-5 w-5 ${isExpired ? "text-red-600" : "text-[#17457C]"}`} />
                        <p className={isExpired ? "text-red-800" : "text-blue-800"}>
                            {isExpired
                                ? "Bu teklifin süresi dolmuştur"
                                : `Teklif geçerlilik tarihi: ${new Date(quote.validUntil).toLocaleDateString("tr-TR")}`
                            }
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Products */}
            <Card>
                <CardHeader>
                    <CardTitle>Teklif Edilen Ürünler</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Ürün</TableHead>
                                <TableHead className="text-center">Adet</TableHead>
                                <TableHead className="text-right">Liste Fiyatı</TableHead>
                                <TableHead className="text-right">Teklif Fiyatı</TableHead>
                                <TableHead className="text-right">Toplam</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {quote.items.map((item) => {
                                const hasDiscount = item.quotedPrice && item.quotedPrice < item.listPrice;
                                return (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">
                                            {item.productName}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {item.quantity}
                                        </TableCell>
                                        <TableCell className="text-right text-gray-500">
                                            {formatPrice(item.listPrice)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {item.quotedPrice ? (
                                                <span className={hasDiscount ? "text-green-600 font-medium" : ""}>
                                                    {formatPrice(item.quotedPrice)}
                                                    {hasDiscount && (
                                                        <span className="text-xs ml-1">
                                                            (-%{((item.listPrice - item.quotedPrice) / item.listPrice * 100).toFixed(0)})
                                                        </span>
                                                    )}
                                                </span>
                                            ) : "-"}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {item.lineTotal ? formatPrice(item.lineTotal) : "-"}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Summary */}
            {quote.total && (
                <Card>
                    <CardContent className="py-6">
                        <div className="space-y-3">
                            <div className="flex justify-between text-gray-600">
                                <span>Ara Toplam</span>
                                <span>{formatPrice(quote.subtotal || 0)}</span>
                            </div>
                            {(quote.discount || 0) > 0 && (
                                <div className="flex justify-between text-green-600">
                                    <span>Ekstra İskonto</span>
                                    <span>-{formatPrice(quote.discount || 0)}</span>
                                </div>
                            )}
                            <hr />
                            <div className="flex justify-between text-xl font-bold">
                                <span>Toplam</span>
                                <span className="text-[#17457C]">{formatPrice(quote.total)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Customer Notes */}
            {quote.notes && (
                <Card>
                    <CardHeader>
                        <CardTitle>Sizin Notunuz</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-gray-600">{quote.notes}</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
