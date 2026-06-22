import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileQuestion, Eye } from "lucide-react";
import Link from "next/link";
import { formatPrice } from "@/lib/helpers";

const statusLabels: Record<string, { label: string; color: string }> = {
    PENDING: { label: "Bekliyor", color: "bg-yellow-100 text-yellow-800" },
    REVIEWING: { label: "İnceleniyor", color: "bg-blue-100 text-blue-800" },
    QUOTED: { label: "Teklif Verildi", color: "bg-purple-100 text-purple-800" },
    ACCEPTED: { label: "Kabul Edildi", color: "bg-green-100 text-green-800" },
    REJECTED: { label: "Reddedildi", color: "bg-red-100 text-red-800" },
    EXPIRED: { label: "Süresi Doldu", color: "bg-gray-100 text-gray-800" },
    CONVERTED: { label: "Siparişe Dönüştü", color: "bg-emerald-100 text-emerald-800" },
};

async function getQuotes() {
    return prisma.quote.findMany({
        include: {
            user: {
                select: {
                    email: true,
                    companyName: true,
                }
            },
            items: true,
        },
        orderBy: { createdAt: "desc" }
    });
}

export default async function QuotesPage() {
    const quotes = await getQuotes();

    const pendingCount = quotes.filter(q => q.status === "PENDING").length;
    const quotedCount = quotes.filter(q => q.status === "QUOTED").length;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <FileQuestion className="h-6 w-6 text-[#17457C]" />
                        Teklifler
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400">
                        Müşteri teklif taleplerini yönetin
                    </p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Toplam Teklif
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{quotes.length}</div>
                    </CardContent>
                </Card>

                <Card className="border-yellow-200 bg-yellow-50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-yellow-700">
                            Bekleyen Talepler
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-800">{pendingCount}</div>
                    </CardContent>
                </Card>

                <Card className="border-purple-200 bg-purple-50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-purple-700">
                            Yanıt Bekleyen
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-800">{quotedCount}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Quotes Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Teklif No</TableHead>
                                <TableHead>Müşteri</TableHead>
                                <TableHead className="text-center">Ürün Sayısı</TableHead>
                                <TableHead className="text-right">Toplam</TableHead>
                                <TableHead>Durum</TableHead>
                                <TableHead>Tarih</TableHead>
                                <TableHead className="text-right">İşlem</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {quotes.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                                        Henüz teklif talebi bulunmuyor
                                    </TableCell>
                                </TableRow>
                            ) : (
                                quotes.map((quote) => {
                                    const status = statusLabels[quote.status] || { label: quote.status, color: "bg-gray-100 text-gray-800" };
                                    return (
                                        <TableRow key={quote.id}>
                                            <TableCell className="font-mono font-medium">
                                                {quote.quoteNumber}
                                            </TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium">{quote.user.companyName || "-"}</p>
                                                    <p className="text-sm text-gray-500">{quote.user.email}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {quote.items.length}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                {quote.total ? formatPrice(Number(quote.total)) : "-"}
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
                                                <Link href={`/admin/quotes/${quote.id}`}>
                                                    <Button size="sm" variant="outline">
                                                        <Eye className="h-4 w-4 mr-1" />
                                                        Detay
                                                    </Button>
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
