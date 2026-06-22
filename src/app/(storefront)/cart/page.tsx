"use client";

import { useCartStore } from "@/stores/cart-store";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatPrice, calculatePrice } from "@/lib/helpers";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, FileQuestion } from "lucide-react";

export default function CartPage() {
    const { items, removeItem, updateQuantity, getSummary, discountRate, isAuthenticated } =
        useCartStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="text-center py-16">Yükleniyor...</div>
            </div>
        );
    }

    const summary = getSummary();

    if (items.length === 0) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="text-center py-16 space-y-4">
                    <ShoppingBag className="h-16 w-16 mx-auto text-gray-300" />
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Sepetiniz Boş
                    </h2>
                    <p className="text-gray-500">
                        Sepetinize henüz ürün eklemediniz.
                    </p>
                    <Link href="/products">
                        <Button>
                            Alışverişe Başla
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
                Sepetim ({summary.itemCount} ürün)
            </h1>

            <div className="grid gap-8 lg:grid-cols-3">
                {/* Cart Items */}
                <div className="lg:col-span-2 space-y-4">
                    {items.map((item) => (
                        <Card key={item.productId}>
                            <CardContent className="p-4">
                                <div className="flex flex-col sm:flex-row gap-4">
                                    {/* Image */}
                                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden flex-shrink-0 mx-auto sm:mx-0">
                                        {item.image ? (
                                            <Image
                                                src={item.image}
                                                alt={item.name}
                                                fill
                                                className="object-cover"
                                            />
                                        ) : (
                                            <div className="flex items-center justify-center h-full">
                                                <ShoppingBag className="h-8 w-8 text-gray-300" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Details */}
                                    <div className="flex-1 min-w-0">
                                        <Link
                                            href={`/products/${item.slug}`}
                                            className="font-medium text-gray-900 dark:text-white hover:text-[#17457C] line-clamp-2 text-sm sm:text-base"
                                        >
                                            {item.name}
                                        </Link>
                                        {(() => {
                                            const price = calculatePrice(
                                                item.listPrice,
                                                item.salePrice || undefined, // Use item's salePrice if available
                                                item.discountRate !== undefined ? item.discountRate : discountRate,
                                                item.vatRate
                                            );
                                            return (
                                                <div className="mt-1">
                                                    {price.finalPrice < item.listPrice && (
                                                        <span className="text-xs text-gray-400 line-through mr-1">
                                                            {formatPrice(item.listPrice)}
                                                        </span>
                                                    )}
                                                    <p className="text-xs sm:text-sm text-gray-500 inline-block">
                                                        Birim fiyat:{" "}
                                                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                                                            {formatPrice(price.finalPrice)}
                                                        </span>
                                                    </p>
                                                </div>
                                            );
                                        })()}
                                        <p className="text-xs text-gray-400">
                                            KDV: %{item.vatRate}
                                        </p>

                                        {/* Quantity & Price Row */}
                                        <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
                                            <div className="flex items-center gap-1 sm:gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() =>
                                                        updateQuantity(item.productId, item.quantity - 1)
                                                    }
                                                    disabled={item.quantity <= item.minQuantity}
                                                >
                                                    <Minus className="h-4 w-4" />
                                                </Button>
                                                <Input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) =>
                                                        updateQuantity(
                                                            item.productId,
                                                            Number(e.target.value)
                                                        )
                                                    }
                                                    className="w-12 sm:w-16 h-8 text-center text-sm"
                                                    min={item.minQuantity}
                                                    max={item.stock}
                                                />
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() =>
                                                        updateQuantity(item.productId, item.quantity + 1)
                                                    }
                                                    disabled={item.quantity >= item.stock}
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-red-500 hover:text-red-600 h-8 w-8"
                                                    onClick={() => removeItem(item.productId)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>

                                            {/* Line Total */}
                                            <p className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                                                {formatPrice(
                                                    calculatePrice(
                                                        item.listPrice,
                                                        item.salePrice || undefined,
                                                        item.discountRate !== undefined ? item.discountRate : discountRate,
                                                        item.vatRate
                                                    ).finalPrice * item.quantity
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Order Summary */}
                <div>
                    <Card className="sticky top-24">
                        <CardHeader>
                            <CardTitle>Sipariş Özeti</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Ara Toplam</span>
                                <span>{formatPrice(summary.subtotal)}</span>
                            </div>
                            {summary.discountAmount > 0 && (
                                <div className="flex justify-between text-green-600">
                                    <span>İskonto ({Math.round((summary.discountAmount / (summary.total + summary.discountAmount)) * 100)}%)</span>
                                    <span>-{formatPrice(summary.discountAmount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-gray-500">KDV</span>
                                <span>{formatPrice(summary.vatAmount)}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between text-lg font-bold">
                                <span>Toplam</span>
                                <span className="text-[#17457C]">
                                    {formatPrice(summary.total)}
                                </span>
                            </div>

                            <Link href={isAuthenticated ? "/checkout" : "/checkout/auth"} className="block">
                                <Button className="w-full bg-[#17457C] hover:bg-[#0f3460] text-white rounded-xl py-6 text-lg font-bold shadow-lg shadow-[#17457C]/20">
                                    Siparişi Tamamla
                                </Button>
                            </Link>

                            <Link href="/products" className="block text-center mt-4">
                                <Button variant="outline" className="w-full rounded-xl py-6">
                                    Alışverişe Devam Et
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
