"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { FileQuestion, ShoppingCart, Loader2, Trash2 } from "lucide-react";
import { useCartStore } from "@/stores/cart-store";
import { formatPrice } from "@/lib/helpers";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";

export default function RequestQuotePage() {
    const router = useRouter();
    const { items, removeItem, clearCart } = useCartStore();
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="flex justify-center items-center min-h-[400px]">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
            </div>
        );
    }

    const handleSubmit = async () => {
        if (items.length === 0) {
            toast.error("Sepetiniz boş");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/quotes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    items: items.map(item => ({
                        productId: item.productId,
                        quantity: item.quantity
                    })),
                    notes
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Teklif oluşturulamadı");
            }

            toast.success(`Teklif talebiniz alındı! (${data.quoteNumber})`);
            clearCart();
            router.push("/account/quotes");
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const subtotal = items.reduce((sum, item) => sum + item.listPrice * item.quantity, 0);

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <FileQuestion className="h-6 w-6 text-[#17457C]" />
                        Teklif Talebi Oluştur
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Sepetinizdeki ürünler için özel fiyat teklifi alın
                    </p>
                </div>

                {items.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <ShoppingCart className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900">Sepetiniz Boş</h3>
                            <p className="text-gray-500 mt-2">
                                Teklif talebi oluşturmak için önce sepete ürün eklemelisiniz
                            </p>
                            <Link href="/products">
                                <Button className="mt-4">Ürünlere Git</Button>
                            </Link>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {/* Products */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Teklif Edilecek Ürünler</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Ürün</TableHead>
                                            <TableHead className="text-center">Adet</TableHead>
                                            <TableHead className="text-right">Birim Fiyat</TableHead>
                                            <TableHead className="text-right">Toplam</TableHead>
                                            <TableHead className="w-12"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map((item) => (
                                            <TableRow key={item.productId}>
                                                <TableCell className="font-medium">
                                                    {item.name}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {item.quantity}
                                                </TableCell>
                                                <TableCell className="text-right text-gray-500">
                                                    {formatPrice(item.listPrice)}
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {formatPrice(item.listPrice * item.quantity)}
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-red-500 hover:text-red-700"
                                                        onClick={() => removeItem(item.productId)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* Notes */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Teklif Notu</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Label className="text-gray-500 text-sm">
                                    Özel isteklerinizi veya notlarınızı buraya yazabilirsiniz
                                </Label>
                                <Textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Örn: Toplu alım yapacağız, ödeme vadesi hakkında bilgi istiyoruz..."
                                    rows={4}
                                    className="mt-2"
                                />
                            </CardContent>
                        </Card>

                        {/* Summary */}
                        <Card>
                            <CardContent className="py-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-gray-500 text-sm">Liste Fiyatı Toplamı</p>
                                        <p className="text-2xl font-bold">{formatPrice(subtotal)}</p>
                                        <p className="text-sm text-green-600 mt-1">
                                            Teklif sonrası indirimli fiyat alabilirsiniz
                                        </p>
                                    </div>
                                    <Button
                                        size="lg"
                                        onClick={handleSubmit}
                                        disabled={loading}
                                        className="min-w-[200px]"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Gönderiliyor...
                                            </>
                                        ) : (
                                            <>
                                                <FileQuestion className="h-4 w-4 mr-2" />
                                                Teklif Talep Et
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <p className="text-center text-sm text-gray-500">
                            Teklif talebiniz genellikle 24 saat içinde değerlendirilir.
                            Sonuç için e-posta bildirimini kontrol edin.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
