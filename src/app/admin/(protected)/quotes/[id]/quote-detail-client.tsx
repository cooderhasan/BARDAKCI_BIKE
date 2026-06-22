"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Save, CheckCircle, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { formatPrice } from "@/lib/helpers";
import { toast } from "sonner";
import { updateQuotePrices, updateQuoteStatus, convertQuoteToOrder } from "../actions";
import { useRouter } from "next/navigation";

interface QuoteItem {
    id: string;
    productId: string;
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
    adminNotes: string | null;
    subtotal: number | null;
    discount: number | null;
    total: number | null;
    validUntil: string | null;
    createdAt: string;
    user: {
        email: string;
        companyName: string | null;
        phone: string | null;
    };
    items: QuoteItem[];
}

interface QuoteDetailClientProps {
    quote: Quote;
}

const statusLabels: Record<string, { label: string; color: string }> = {
    PENDING: { label: "Bekliyor", color: "bg-yellow-100 text-yellow-800" },
    REVIEWING: { label: "İnceleniyor", color: "bg-blue-100 text-blue-800" },
    QUOTED: { label: "Teklif Verildi", color: "bg-purple-100 text-purple-800" },
    ACCEPTED: { label: "Kabul Edildi", color: "bg-green-100 text-green-800" },
    REJECTED: { label: "Reddedildi", color: "bg-red-100 text-red-800" },
    EXPIRED: { label: "Süresi Doldu", color: "bg-gray-100 text-gray-800" },
    CONVERTED: { label: "Siparişe Dönüştü", color: "bg-emerald-100 text-emerald-800" },
};

export function QuoteDetailClient({ quote }: QuoteDetailClientProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [itemPrices, setItemPrices] = useState<Record<string, number>>(
        quote.items.reduce((acc, item) => ({
            ...acc,
            [item.id]: item.quotedPrice ?? item.listPrice
        }), {})
    );
    const [discount, setDiscount] = useState(quote.discount || 0);
    const [validDays, setValidDays] = useState(7);
    const [adminNotes, setAdminNotes] = useState(quote.adminNotes || "");

    const status = statusLabels[quote.status] || { label: quote.status, color: "bg-gray-100" };

    const subtotal = quote.items.reduce((sum, item) => {
        const price = itemPrices[item.id] || item.listPrice;
        return sum + price * item.quantity;
    }, 0);

    const total = subtotal - discount;

    const handleSaveQuote = async () => {
        setLoading(true);
        try {
            const items = quote.items.map(item => ({
                itemId: item.id,
                quotedPrice: itemPrices[item.id] || item.listPrice
            }));

            await updateQuotePrices(quote.id, items, discount, validDays, adminNotes);
            toast.success("Teklif kaydedildi ve müşteriye gönderildi!");
            router.refresh();
        } catch (error) {
            toast.error("Teklif kaydedilemedi");
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async () => {
        if (!confirm("Bu teklifi reddetmek istediğinize emin misiniz?")) return;

        setLoading(true);
        try {
            await updateQuoteStatus(quote.id, "REJECTED");
            toast.success("Teklif reddedildi");
            router.refresh();
        } catch (error) {
            toast.error("İşlem başarısız");
        } finally {
            setLoading(false);
        }
    };

    const handleConvert = async () => {
        if (!confirm("Bu teklifi siparişe dönüştürmek istediğinize emin misiniz?")) return;

        setLoading(true);
        try {
            const result = await convertQuoteToOrder(quote.id);
            toast.success("Teklif siparişe dönüştürüldü!");
            router.push(`/admin/orders/${result.orderId}`);
        } catch (error: any) {
            toast.error(error.message || "İşlem başarısız");
        } finally {
            setLoading(false);
        }
    };

    const canEdit = ["PENDING", "REVIEWING"].includes(quote.status);
    const canConvert = quote.status === "ACCEPTED";

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Link href="/admin/quotes">
                            <Button variant="ghost" size="sm">
                                <ArrowLeft className="h-4 w-4 mr-1" />
                                Geri
                            </Button>
                        </Link>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                            {quote.quoteNumber}
                        </h2>
                        <Badge className={status.color}>{status.label}</Badge>
                    </div>
                    <p className="text-gray-500">
                        {new Date(quote.createdAt).toLocaleDateString("tr-TR", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                        })}
                    </p>
                </div>

                <div className="flex gap-2">
                    {canConvert && (
                        <Button onClick={handleConvert} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Siparişe Dönüştür
                        </Button>
                    )}
                    {canEdit && (
                        <>
                            <Button variant="destructive" onClick={handleReject} disabled={loading}>
                                <XCircle className="h-4 w-4 mr-2" />
                                Reddet
                            </Button>
                            <Button onClick={handleSaveQuote} disabled={loading}>
                                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                                Teklif Gönder
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Customer Info */}
            <Card>
                <CardHeader>
                    <CardTitle>Müşteri Bilgileri</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div>
                            <Label className="text-gray-500">Firma</Label>
                            <p className="font-medium">{quote.user.companyName || "-"}</p>
                        </div>
                        <div>
                            <Label className="text-gray-500">E-posta</Label>
                            <p className="font-medium">{quote.user.email}</p>
                        </div>
                        <div>
                            <Label className="text-gray-500">Telefon</Label>
                            <p className="font-medium">{quote.user.phone || "-"}</p>
                        </div>
                    </div>
                    {quote.notes && (
                        <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                            <Label className="text-yellow-700">Müşteri Notu</Label>
                            <p className="mt-1">{quote.notes}</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Products */}
            <Card>
                <CardHeader>
                    <CardTitle>Ürünler</CardTitle>
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
                                const quotedPrice = itemPrices[item.id] || item.listPrice;
                                const lineTotal = quotedPrice * item.quantity;
                                const discountPercent = ((item.listPrice - quotedPrice) / item.listPrice * 100).toFixed(1);

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
                                            {canEdit ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        className="w-28 text-right"
                                                        value={quotedPrice}
                                                        onChange={(e) => setItemPrices(prev => ({
                                                            ...prev,
                                                            [item.id]: parseFloat(e.target.value) || 0
                                                        }))}
                                                    />
                                                    {quotedPrice < item.listPrice && (
                                                        <span className="text-xs text-green-600">
                                                            -%{discountPercent}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="font-medium">{formatPrice(quotedPrice)}</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {formatPrice(lineTotal)}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Pricing & Notes */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Fiyatlandırma</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between">
                            <span>Ara Toplam</span>
                            <span className="font-medium">{formatPrice(subtotal)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Ekstra İskonto</span>
                            {canEdit ? (
                                <Input
                                    type="number"
                                    step="0.01"
                                    className="w-28 text-right"
                                    value={discount}
                                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                                />
                            ) : (
                                <span className="font-medium">-{formatPrice(discount)}</span>
                            )}
                        </div>
                        <hr />
                        <div className="flex justify-between text-lg font-bold">
                            <span>Toplam</span>
                            <span className="text-[#17457C]">{formatPrice(total)}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Teklif Ayarları</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {canEdit && (
                            <div className="space-y-2">
                                <Label>Geçerlilik Süresi (gün)</Label>
                                <Input
                                    type="number"
                                    value={validDays}
                                    onChange={(e) => setValidDays(parseInt(e.target.value) || 7)}
                                />
                            </div>
                        )}
                        {quote.validUntil && (
                            <div>
                                <Label className="text-gray-500">Son Geçerlilik</Label>
                                <p className="font-medium">
                                    {new Date(quote.validUntil).toLocaleDateString("tr-TR")}
                                </p>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>Admin Notu</Label>
                            {canEdit ? (
                                <Textarea
                                    value={adminNotes}
                                    onChange={(e) => setAdminNotes(e.target.value)}
                                    placeholder="İç not (müşteri görmez)..."
                                    rows={3}
                                />
                            ) : (
                                <p className="text-gray-600">{adminNotes || "-"}</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
