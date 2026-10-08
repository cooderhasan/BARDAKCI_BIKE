"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CategoryTreeSelect } from "@/components/ui/category-tree-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Loader2, ArrowRight, ShoppingBag } from "lucide-react";
import { previewBulkN11PriceUpdate, executeBulkN11PriceUpdate, N11PricePreviewResult } from "@/app/admin/(protected)/bulk-updates/actions";
import { toast } from "sonner";
import { formatPrice } from "@/lib/helpers";

interface BulkN11PriceFormProps {
    categories: any[];
    brands: any[];
}

export function BulkN11PriceForm({ categories, brands }: BulkN11PriceFormProps) {
    // Selection State
    const [selectedBrand, setSelectedBrand] = useState<string>("ALL");
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [isAllCategories, setIsAllCategories] = useState(false);

    // Operation State
    const [operation, setOperation] = useState<"INCREASE" | "DECREASE">("INCREASE");
    const [updateType, setUpdateType] = useState<"PERCENTAGE" | "FIXED_AMOUNT">("PERCENTAGE");
    const [value, setValue] = useState<string>("10");

    // Execution State
    const [loading, setLoading] = useState(false);
    const [previewResults, setPreviewResults] = useState<N11PricePreviewResult[] | null>(null);

    const handlePreview = async () => {
        if (!value || Number(value) < 0) {
            toast.error("Geçerli bir değer giriniz.");
            return;
        }

        setLoading(true);
        try {
            const results = await previewBulkN11PriceUpdate(
                {
                    brandId: selectedBrand,
                    categoryId: isAllCategories ? "ALL" : (selectedCategories.length > 0 ? selectedCategories[0] : undefined),
                },
                {
                    operation,
                    type: updateType,
                    value: Number(value),
                }
            );

            if (results.length === 0) {
                toast.warning("Seçilen kriterlere uygun N11 ürünü bulunamadı.");
                setPreviewResults(null);
            } else {
                setPreviewResults(results);
                toast.success(`${results.length} N11 ürünü için önizleme hazırlandı.`);
            }
        } catch (error) {
            toast.error("Önizleme oluşturulurken hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    const handleExecute = async () => {
        if (!previewResults) return;
        if (!confirm(`${previewResults.length} N11 ürününün fiyatı güncellenecek ve kuyruğa atılacak. Emin misiniz?`)) return;

        setLoading(true);
        try {
            await executeBulkN11PriceUpdate(
                {
                    brandId: selectedBrand,
                    categoryId: isAllCategories ? "ALL" : (selectedCategories.length > 0 ? selectedCategories[0] : undefined),
                },
                {
                    operation,
                    type: updateType,
                    value: Number(value),
                }
            );

            toast.success("N11 fiyatları başarıyla güncellendi ve senkronizasyon kuyruğuna eklendi.");
            setPreviewResults(null);
        } catch (error) {
            toast.error("Güncelleme işlemi başarısız oldu.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Left: Configuration */}
            <div className="space-y-6">
                <Card className="border-purple-200 dark:border-purple-900">
                    <CardHeader className="bg-purple-50/50 dark:bg-purple-900/10">
                        <div className="flex items-center gap-2">
                            <ShoppingBag className="h-5 w-5 text-purple-600" />
                            <CardTitle>N11 Hedef Seçimi</CardTitle>
                        </div>
                        <CardDescription>
                            Sadece N11'de aktif olan ürünler etkilenecektir.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                        <div className="space-y-2">
                            <Label>Marka</Label>
                            <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Marka Seçin" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Tüm Markalar</SelectItem>
                                    {brands.map((b) => (
                                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Kategori</Label>
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id="all-cats-n11"
                                        checked={isAllCategories}
                                        onCheckedChange={setIsAllCategories}
                                    />
                                    <Label htmlFor="all-cats-n11" className="text-xs font-normal cursor-pointer">
                                        Tüm Kategoriler
                                    </Label>
                                </div>
                            </div>

                            {!isAllCategories && (
                                <CategoryTreeSelect
                                    options={categories}
                                    selected={selectedCategories}
                                    onChange={setSelectedCategories}
                                    placeholder="Kategori Seçin (Opsiyonel)"
                                />
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>İşlem Detayları</CardTitle>
                        <CardDescription>
                            N11'e özel fiyat değişikliğini belirleyin.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>İşlem Türü</Label>
                            <RadioGroup
                                value={operation}
                                onValueChange={(v: any) => setOperation(v)}
                                className="flex gap-4"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="INCREASE" id="inc-n11" />
                                    <Label htmlFor="inc-n11">Fiyat Artır (Zam)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="DECREASE" id="dec-n11" />
                                    <Label htmlFor="dec-n11">Fiyat İndir (İndirim)</Label>
                                </div>
                            </RadioGroup>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Birim</Label>
                                <Select value={updateType} onValueChange={(v: any) => setUpdateType(v)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PERCENTAGE">Yüzde (%)</SelectItem>
                                        <SelectItem value="FIXED_AMOUNT">Sabit Tutar (TL)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Değer</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={value}
                                    onChange={(e) => setValue(e.target.value)}
                                />
                            </div>
                        </div>

                        <Button onClick={handlePreview} disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700">
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            N11 Önizleme Oluştur
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Right: Preview */}
            <div className="space-y-6">
                <Card className="h-full flex flex-col border-purple-100">
                    <CardHeader>
                        <CardTitle>Önizleme ve Onay</CardTitle>
                        <CardDescription>
                            N11'de güncellenecek fiyatları kontrol edin.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-auto min-h-[400px]">
                        {!previewResults ? (
                            <div className="flex items-center justify-center h-full text-muted-foreground p-8 text-center border-2 border-dashed rounded-lg border-purple-100">
                                İşlem detaylarını belirleyip "Önizleme Oluştur" butonuna tıklayın.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                                    <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                                        Toplam <strong>{previewResults.length}</strong> ürünün N11 fiyatı güncellenecek.
                                    </p>
                                    <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                                        İşlem sonrası fiyatlar otomatik olarak N11 API kuyruğuna iletilecektir.
                                    </p>
                                </div>

                                <div className="border rounded-md border-purple-100">
                                    <Table>
                                        <TableHeader className="bg-purple-50/50">
                                            <TableRow>
                                                <TableHead>Ürün / Barkod</TableHead>
                                                <TableHead>Mevcut N11</TableHead>
                                                <TableHead></TableHead>
                                                <TableHead>Yeni N11</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {previewResults.slice(0, 50).map((p) => (
                                                <TableRow key={p.id} className="hover:bg-purple-50/10">
                                                    <TableCell className="max-w-[200px] truncate" title={p.name}>
                                                        <div className="font-medium text-xs">{p.name}</div>
                                                        <div className="text-[10px] text-muted-foreground font-mono">{p.barcode || p.sku}</div>
                                                    </TableCell>
                                                    <TableCell className="text-xs">{formatPrice(p.oldPrice)}</TableCell>
                                                    <TableCell>
                                                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                                    </TableCell>
                                                    <TableCell className="font-bold text-purple-600 text-xs">
                                                        {formatPrice(p.newPrice)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    {previewResults.length > 50 && (
                                        <div className="p-2 text-center text-[10px] text-muted-foreground border-t">
                                            ve {previewResults.length - 50} ürün daha...
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>

                    {previewResults && (
                        <div className="p-6 border-t bg-gray-50 dark:bg-gray-900/50 mt-auto">
                            <Button
                                onClick={handleExecute}
                                disabled={loading}
                                size="lg"
                                className="w-full bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-200 dark:shadow-none"
                            >
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {previewResults.length} Ürünü N11'de Güncelle
                            </Button>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
