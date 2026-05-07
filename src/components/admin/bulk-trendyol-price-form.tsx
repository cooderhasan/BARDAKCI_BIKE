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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Loader2, ArrowRight, ShoppingCart } from "lucide-react";
import { previewBulkTrendyolPriceUpdate, executeBulkTrendyolPriceUpdate, TrendyolPricePreviewResult } from "@/app/admin/(protected)/bulk-updates/actions";
import { toast } from "sonner";
import { formatPrice } from "@/lib/helpers";

interface BulkTrendyolPriceFormProps {
    categories: any[];
    brands: any[];
}

export function BulkTrendyolPriceForm({ categories, brands }: BulkTrendyolPriceFormProps) {
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
    const [previewResults, setPreviewResults] = useState<TrendyolPricePreviewResult[] | null>(null);

    const handlePreview = async () => {
        if (!value || Number(value) < 0) {
            toast.error("Geçerli bir değer giriniz.");
            return;
        }

        setLoading(true);
        try {
            const results = await previewBulkTrendyolPriceUpdate(
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
                toast.warning("Seçilen kriterlere uygun Trendyol ürünü bulunamadı.");
                setPreviewResults(null);
            } else {
                setPreviewResults(results);
                toast.success(`${results.length} Trendyol ürünü için önizleme hazırlandı.`);
            }
        } catch (error) {
            toast.error("Önizleme oluşturulurken hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    const handleExecute = async () => {
        if (!previewResults) return;
        if (!confirm(`${previewResults.length} Trendyol ürününün fiyatı güncellenecek ve kuyruğa atılacak. Emin misiniz?`)) return;

        setLoading(true);
        try {
            await executeBulkTrendyolPriceUpdate(
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

            toast.success("Trendyol fiyatları başarıyla güncellendi ve senkronizasyon kuyruğuna eklendi.");
            setPreviewResults(null);
        } catch (error) {
            toast.error("Güncelleme işlemi başarısız oldu.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid gap-6 md:grid-cols-2">
            {/* Left: Configuration */}
            <div className="space-y-6">
                <Card className="border-orange-200 dark:border-orange-900">
                    <CardHeader className="bg-orange-50/50 dark:bg-orange-900/10">
                        <div className="flex items-center gap-2">
                            <ShoppingCart className="h-5 w-5 text-orange-600" />
                            <CardTitle>Trendyol Hedef Seçimi</CardTitle>
                        </div>
                        <CardDescription>
                            Sadece Trendyol'da aktif olan ürünler etkilenecektir.
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
                                        id="all-cats-ty"
                                        checked={isAllCategories}
                                        onCheckedChange={setIsAllCategories}
                                    />
                                    <Label htmlFor="all-cats-ty" className="text-xs font-normal cursor-pointer">
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
                            Trendyol'a özel fiyat değişikliğini belirleyin.
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
                                    <RadioGroupItem value="INCREASE" id="inc-ty" />
                                    <Label htmlFor="inc-ty">Fiyat Artır (Zam)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="DECREASE" id="dec-ty" />
                                    <Label htmlFor="dec-ty">Fiyat İndir (İndirim)</Label>
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

                        <Button onClick={handlePreview} disabled={loading} className="w-full bg-orange-600 hover:bg-orange-700">
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Trendyol Önizleme Oluştur
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Right: Preview */}
            <div className="space-y-6">
                <Card className="h-full flex flex-col">
                    <CardHeader>
                        <CardTitle>Önizleme ve Onay</CardTitle>
                        <CardDescription>
                            Trendyol'da güncellenecek fiyatları kontrol edin.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-auto min-h-[400px]">
                        {!previewResults ? (
                            <div className="flex items-center justify-center h-full text-muted-foreground p-8 text-center border-2 border-dashed rounded-lg">
                                İşlem detaylarını belirleyip "Önizleme Oluştur" butonuna tıklayın.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                        Toplam <strong>{previewResults.length}</strong> ürünün Trendyol fiyatı güncellenecek.
                                    </p>
                                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                        İşlem sonrası fiyatlar otomatik olarak Trendyol API kuyruğuna iletilecektir.
                                    </p>
                                </div>

                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Ürün / Barkod</TableHead>
                                                <TableHead>Mevcut TY</TableHead>
                                                <TableHead></TableHead>
                                                <TableHead>Yeni TY</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {previewResults.slice(0, 50).map((p) => (
                                                <TableRow key={p.id}>
                                                    <TableCell className="max-w-[200px] truncate" title={p.name}>
                                                        <div className="font-medium">{p.name}</div>
                                                        <div className="text-[10px] text-muted-foreground font-mono">{p.barcode}</div>
                                                    </TableCell>
                                                    <TableCell>{formatPrice(p.oldPrice)}</TableCell>
                                                    <TableCell>
                                                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                                    </TableCell>
                                                    <TableCell className="font-bold text-orange-600">
                                                        {formatPrice(p.newPrice)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    {previewResults.length > 50 && (
                                        <div className="p-2 text-center text-sm text-muted-foreground border-t">
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
                                className="w-full bg-orange-600 hover:bg-orange-700"
                            >
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {previewResults.length} Ürünü Trendyol'da Güncelle
                            </Button>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
