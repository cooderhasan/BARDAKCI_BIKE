"use client";

import { useState, useRef, useEffect } from "react";
import { useCartStore } from "@/stores/cart-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, ShoppingCart, Search, AlertCircle, CheckCircle2 } from "lucide-react";
import { getProductByCode, type QuickOrderProduct } from "./actions";
import { toast } from "sonner";
import { formatPrice } from "@/lib/helpers";
import Image from "next/image";

interface OrderRow {
    id: string; // unique id for list key
    code: string;
    quantity: number;
    product?: QuickOrderProduct;
    loading: boolean;
    error?: string;
}

export default function QuickOrderPage() {
    // Start with 5 empty rows
    const [rows, setRows] = useState<OrderRow[]>(
        Array.from({ length: 5 }).map(() => ({
            id: crypto.randomUUID(),
            code: "",
            quantity: 1,
            loading: false
        }))
    );

    const { addItem } = useCartStore();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Debounce timeout ref
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleCodeChange = (id: string, code: string) => {
        setRows(prev => prev.map(row => {
            if (row.id === id) {
                return { ...row, code, error: undefined, product: undefined }; // Reset product when code changes
            }
            return row;
        }));

        // Debounce search
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        if (code.length >= 3) {
            timeoutRef.current = setTimeout(() => {
                lookupProduct(id, code);
            }, 500);
        }
    };

    const lookupProduct = async (id: string, code: string) => {
        setRows(prev => prev.map(row => row.id === id ? { ...row, loading: true, error: undefined } : row));

        const result = await getProductByCode(code);

        setRows(prev => prev.map(row => {
            if (row.id === id) {
                if (result.success && result.product) {
                    return { ...row, loading: false, product: result.product, error: undefined };
                } else {
                    return { ...row, loading: false, product: undefined, error: result.error || "Bulunamadı" };
                }
            }
            return row;
        }));
    };

    const handleQuantityChange = (id: string, qty: string) => {
        const quantity = parseInt(qty);
        if (isNaN(quantity) || quantity < 1) return;

        setRows(prev => prev.map(row =>
            row.id === id ? { ...row, quantity } : row
        ));
    };

    const addRow = () => {
        setRows(prev => [
            ...prev,
            { id: crypto.randomUUID(), code: "", quantity: 1, loading: false }
        ]);
    };

    const removeRow = (id: string) => {
        setRows(prev => prev.filter(row => row.id !== id));
    };

    const handleBulkAddToCart = () => {
        const validRows = rows.filter(row => row.product && !row.error && row.quantity > 0);

        if (validRows.length === 0) {
            toast.error("Sepete eklenecek geçerli ürün bulunamadı.");
            return;
        }

        setIsSubmitting(true);
        let addedCount = 0;

        try {
            validRows.forEach(row => {
                if (row.product) {
                    // Check stock locally?
                    if (row.product.stock < row.quantity) {
                        toast.warning(`${row.product.name} için yeterli stok yok. Mevcut: ${row.product.stock}`);
                    }

                    addItem({
                        productId: row.product.id,
                        name: row.product.name,
                        slug: row.product.slug,
                        listPrice: row.product.price,
                        quantity: row.quantity,
                        image: row.product.image || "",
                        vatRate: row.product.vatRate,
                        minQuantity: row.product.minQuantity,
                        stock: row.product.stock,
                        discountRate: 0,
                        desi: row.product.desi,
                        isFreeShipping: row.product.isFreeShipping,
                    });
                    addedCount++;
                }
            });

            toast.success(`${addedCount} çeşit ürün sepete eklendi.`);

            // Clear successful rows or keep them? Maybe clear them to show they are done.
            // Let's clear the valid rows and keep the invalid/empty ones
            const remainingRows = rows.filter(row => !row.product || row.error);
            // If less than 5 rows remain, fill up to 5
            while (remainingRows.length < 5) {
                remainingRows.push({ id: crypto.randomUUID(), code: "", quantity: 1, loading: false });
            }
            setRows(remainingRows);

        } catch (error) {
            toast.error("Sepete eklenirken bir hata oluştu.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Hızlı Sipariş Formu</h1>
                    <p className="text-gray-500 mt-2">
                        Ürün Stok Kodunu (SKU) veya Barkodunu girerek hızlıca sepet oluşturabilirsiniz.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setRows(rows.map(r => ({ ...r, code: "", product: undefined, error: undefined })))}>
                        Formu Temizle
                    </Button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50 dark:bg-gray-900/50">
                            <TableHead className="w-[200px]">Ürün Kodu / Barkod</TableHead>
                            <TableHead>Ürün Bilgisi</TableHead>
                            <TableHead className="w-[120px]">Fiyat</TableHead>
                            <TableHead className="w-[100px]">Stok</TableHead>
                            <TableHead className="w-[100px]">Adet</TableHead>
                            <TableHead className="w-[100px] text-right">Toplam</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row, index) => (
                            <TableRow key={row.id}>
                                <TableCell>
                                    <div className="relative">
                                        <Input
                                            value={row.code}
                                            onChange={(e) => handleCodeChange(row.id, e.target.value)}
                                            placeholder="Kod giriniz..."
                                            className={row.error ? "border-red-500 focus-visible:ring-red-500" : (row.product ? "border-green-500 focus-visible:ring-green-500" : "")}
                                            autoFocus={index === 0 && row.code === ""}
                                        />
                                        {row.loading && (
                                            <div className="absolute right-3 top-2.5">
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                                            </div>
                                        )}
                                    </div>
                                    {row.error && <p className="text-xs text-red-500 mt-1">{row.error}</p>}
                                </TableCell>
                                <TableCell>
                                    {row.product ? (
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 relative rounded overflow-hidden border bg-gray-100 flex-shrink-0">
                                                {row.product.image ? (
                                                    <Image src={row.product.image} alt={row.product.name} fill className="object-cover" />
                                                ) : (
                                                    <div className="flex items-center justify-center h-full w-full text-gray-400">
                                                        <Search className="h-4 w-4" />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm line-clamp-1">{row.product.name}</p>
                                                <p className="text-xs text-gray-500">{row.product.sku}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-gray-400 text-sm">-</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {row.product ? (
                                        <span className="font-medium">{formatPrice(row.product.price)}</span>
                                    ) : (
                                        <span className="text-gray-400">-</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {row.product ? (
                                        <span className={`${row.product.stock < 5 ? "text-red-600 font-bold" : "text-green-600"}`}>
                                            {row.product.stock} Adet
                                        </span>
                                    ) : (
                                        <span className="text-gray-400">-</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={row.quantity}
                                        onChange={(e) => handleQuantityChange(row.id, e.target.value)}
                                        className="w-20"
                                    />
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                    {row.product ? formatPrice(row.product.price * row.quantity) : "-"}
                                </TableCell>
                                <TableCell>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-gray-400 hover:text-red-500"
                                        onClick={() => removeRow(row.id)}
                                        tabIndex={-1}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t flex justify-between items-center">
                    <Button variant="outline" onClick={addRow} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Satır Ekle
                    </Button>

                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm text-gray-500">Toplam Tutar</p>
                            <p className="text-xl font-bold">
                                {formatPrice(rows.reduce((acc, row) => acc + (row.product ? row.product.price * row.quantity : 0), 0))}
                            </p>
                        </div>
                        <Button size="lg" onClick={handleBulkAddToCart} disabled={isSubmitting} className="gap-2">
                            <ShoppingCart className="h-5 w-5" />
                            Sepete Ekle
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
