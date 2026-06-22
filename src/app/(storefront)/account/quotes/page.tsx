"use client";

import { useState, useEffect } from "react";
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
import { FileQuestion, Eye, Loader2 } from "lucide-react";
import Link from "next/link";
import { formatPrice } from "@/lib/helpers";

interface Quote {
    id: string;
    quoteNumber: string;
    status: string;
    total: number | null;
    createdAt: string;
    validUntil: string | null;
    items: { id: string }[];
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

export default function AccountQuotesPage() {
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchQuotes() {
            try {
                const res = await fetch("/api/quotes");
                if (res.ok) {
                    const data = await res.json();
                    setQuotes(data);
                }
            } catch (error) {
                console.error("Fetch quotes error:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchQuotes();
    }, []);

    const pendingQuotes = quotes.filter(q => q.status === "QUOTED").length;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <FileQuestion className="h-6 w-6 text-[#17457C]" />
                    Tekliflerim
                </h2>
                <p className="text-gray-500 mt-1">
                    Teklif taleplerinizi buradan takip edebilirsiniz
                </p>
            </div>

            {pendingQuotes > 0 && (
                <Card className="border-purple-200 bg-purple-50">
                    <CardContent className="py-4">
                        <p className="text-purple-800 font-medium">
                            {pendingQuotes} adet yanıt bekleyen teklifiniz var!
                        </p>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="py-12 flex justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    ) : quotes.length === 0 ? (
                        <div className="py-12 text-center">
                            <FileQuestion className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900">Henüz Teklifiniz Yok</h3>
                            <p className="text-gray-500 mt-2">
                                Sepetinizdeki ürünler için teklif talep edebilirsiniz
                            </p>
                            <Link href="/request-quote">
                                <Button className="mt-4">Teklif İste</Button>
                            </Link>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Teklif No</TableHead>
                                    <TableHead className="text-center">Ürün</TableHead>
                                    <TableHead className="text-right">Toplam</TableHead>
                                    <TableHead>Durum</TableHead>
                                    <TableHead>Tarih</TableHead>
                                    <TableHead className="text-right">İşlem</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {quotes.map((quote) => {
                                    const status = statusLabels[quote.status] || { label: quote.status, color: "bg-gray-100" };
                                    return (
                                        <TableRow key={quote.id}>
                                            <TableCell className="font-mono font-medium">
                                                {quote.quoteNumber}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {quote.items.length}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                {quote.total ? formatPrice(quote.total) : "-"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={status.color}>
                                                    {status.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-gray-500">
                                                {new Date(quote.createdAt).toLocaleDateString("tr-TR")}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Link href={`/account/quotes/${quote.id}`}>
                                                    <Button size="sm" variant="outline">
                                                        <Eye className="h-4 w-4 mr-1" />
                                                        Detay
                                                    </Button>
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
