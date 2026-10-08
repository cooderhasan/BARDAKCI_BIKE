"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Package, Search, RefreshCw } from "lucide-react";
import Link from "next/link";

interface LowStockProduct {
    id: string;
    name: string;
    sku: string | null;
    stock: number;
    criticalStock: number;
    category: { name: string } | null;
    brand: { name: string } | null;
}

export default function StockAlertsPage() {
    const [products, setProducts] = useState<LowStockProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/products/low-stock");
            if (res.ok) {
                const data = await res.json();
                setProducts(data);
            }
        } catch (error) {
            console.error("Error fetching low stock products:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    const filteredProducts = products.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku?.toLowerCase().includes(search.toLowerCase())
    );

    const getStockStatus = (stock: number, criticalStock: number) => {
        if (stock === 0) return { label: "Tükendi", color: "bg-red-100 text-red-800" };
        if (stock <= criticalStock) return { label: "Kritik", color: "bg-orange-100 text-orange-800" };
        return { label: "Normal", color: "bg-green-100 text-green-800" };
    };

    const outOfStock = products.filter(p => p.stock === 0).length;
    const criticalStock = products.filter(p => p.stock > 0 && p.stock <= p.criticalStock).length;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <AlertTriangle className="h-6 w-6 text-orange-500" />
                        Stok Uyarıları
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400">
                        Kritik seviyede veya tükenmiş ürünler
                    </p>
                </div>
                <Button onClick={fetchProducts} variant="outline" disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Yenile
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">
                            Stokta Yok
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-red-800 dark:text-red-200">
                            {outOfStock}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
                            Kritik Seviye
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-orange-800 dark:text-orange-200">
                            {criticalStock}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Toplam Uyarı
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{products.length}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Ürün adı veya stok kodu ile ara..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Products Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Ürün</TableHead>
                                <TableHead>Stok Kodu</TableHead>
                                <TableHead>Kategori</TableHead>
                                <TableHead>Marka</TableHead>
                                <TableHead className="text-center">Mevcut Stok</TableHead>
                                <TableHead className="text-center">Kritik Seviye</TableHead>
                                <TableHead>Durum</TableHead>
                                <TableHead className="text-right">İşlem</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8">
                                        <div className="flex items-center justify-center gap-2">
                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                            Yükleniyor...
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredProducts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                                        <Package className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                                        {search ? "Arama sonucu bulunamadı" : "Stok uyarısı bulunmuyor 🎉"}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredProducts.map((product) => {
                                    const status = getStockStatus(product.stock, product.criticalStock);
                                    return (
                                        <TableRow key={product.id}>
                                            <TableCell className="font-medium">
                                                {product.name}
                                            </TableCell>
                                            <TableCell className="text-gray-500">
                                                {product.sku || "-"}
                                            </TableCell>
                                            <TableCell className="text-gray-500">
                                                {product.category?.name || "-"}
                                            </TableCell>
                                            <TableCell className="text-gray-500">
                                                {product.brand?.name || "-"}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className={`font-bold ${product.stock === 0 ? 'text-red-600' : 'text-orange-600'}`}>
                                                    {product.stock}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center text-gray-500">
                                                {product.criticalStock}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={status.color}>
                                                    {status.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Link href={`/admin/products/${product.id}`}>
                                                    <Button size="sm" variant="outline">
                                                        Düzenle
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
