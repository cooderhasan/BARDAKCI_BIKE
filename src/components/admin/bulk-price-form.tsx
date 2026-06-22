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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Loader2, ArrowRight } from "lucide-react";
import { previewBulkUpdate, executeBulkUpdate, PreviewResult } from "@/app/admin/(protected)/bulk-updates/actions";
import { toast } from "sonner";
import { formatPrice } from "@/lib/helpers";

interface BulkPriceFormProps {
    categories: any[];
    brands: any[];
}

export function BulkPriceForm({ categories, brands }: BulkPriceFormProps) {
    // Selection State
    const [selectedBrand, setSelectedBrand] = useState<string>("ALL");
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [isAllCategories, setIsAllCategories] = useState(false);
    const [priceFilter, setPriceFilter] = useState<"ALL" | "ZERO" | "NON_ZERO">("ALL");

    // Operation State
    const [operation, setOperation] = useState<"INCREASE" | "DECREASE">("INCREASE");
    const [updateType, setUpdateType] = useState<"PERCENTAGE" | "FIXED_AMOUNT">("PERCENTAGE");
    const [value, setValue] = useState<string>("10");

    // Execution State
    const [loading, setLoading] = useState(false);
    const [previewResults, setPreviewResults] = useState<PreviewResult[] | null>(null);

    const handlePreview = async () => {
        if (!value || Number(value) < 0) {
            toast.error("Geçerli bir değer giriniz.");
            return;
        }

        setLoading(true);
        try {
            const results = await previewBulkUpdate(
                {
                    brandId: selectedBrand,
                    categoryId: isAllCategories ? "ALL" : (selectedCategories.length > 0 ? selectedCategories[0] : undefined),
                    priceFilter,
                },
                {
                    operation,
                    type: updateType,
                    value: Number(value),
                }
            );

            if (results.length === 0) {
                toast.warning("Seçilen kriterlere uygun ürün bulunamadı.");
                setPreviewResults(null);
            } else {
                setPreviewResults(results);
                toast.success(`${results.length} ürün için önizleme hazırlandı.`);
            }
        } catch (error) {
            toast.error("Önizleme oluşturulurken hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    const handleExecute = async () => {
        if (!previewResults) return;
        if (!confirm(`${previewResults.length} ürünün fiyatı güncellenecek. Bu işlem geri alınamaz. Emin misiniz?`)) return;

        setLoading(true);
        try {
            // We re-send criteria to be safe, creating a fresh transaction logic on server ideally,
            // but for now we trust the state matches the preview.
            await executeBulkUpdate(
                {
                    brandId: selectedBrand,
                    categoryId: isAllCategories ? "ALL" : (selectedCategories.length > 0 ? selectedCategories[0] : undefined),
                    priceFilter,
                },
                {
                    operation,
                    type: updateType,
                    value: Number(value),
                }
            );

            toast.success("Fiyatlar başarıyla güncellendi.");
            setPreviewResults(null);
            // Optionally reset form
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
                <Card>
                    <CardHeader>
                        <CardTitle>1. Hedef Seçimi</CardTitle>
                        <CardDescription>
                            Fiyat güncellemesi yapılacak ürün grubunu seçin.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
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
                                        id="all-cats"
                                        checked={isAllCategories}
                                        onCheckedChange={setIsAllCategories}
                                    />
                                    <Label htmlFor="all-cats" className="text-xs font-normal cursor-pointer">
                                        Tüm Kategoriler
                                    </Label>
                                </div>
                            </div>

                            {!isAllCategories && (
                                <>
                                    {/* Note: MultiSelect is updated to be CategoryTreeSelect. 
                                        We reuse it but logic handles only single category for now or we take the first one. 
                                    */}
                                    <CategoryTreeSelect
                                        options={categories}
                                        selected={selectedCategories}
                                        onChange={setSelectedCategories}
                                        placeholder="Kategori Seçin (Opsiyonel)"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Sadece tek bir kategori seçimi yapınız. Seçilen kategoriye ait ürünler etkilenir.
                                    </p>
                                </>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Fiyat Durumu</Label>
                            <Select value={priceFilter} onValueChange={(v: any) => setPriceFilter(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Tümü</SelectItem>
                                    <SelectItem value="ZERO">Fiyatı 0 Olanlar (Fiyatsız)</SelectItem>
                                    <SelectItem value="NON_ZERO">Fiyatı Olanlar ({'>'} 0)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>2. İşlem Detayları</CardTitle>
                        <CardDescription>
                            Uygulanacak fiyat değişikliğini belirleyin.
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
                                    <RadioGroupItem value="INCREASE" id="inc" />
                                    <Label htmlFor="inc">Fiyat Artır (Zam)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="DECREASE" id="dec" />
                                    <Label htmlFor="dec">Fiyat İndir (İndirim)</Label>
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

                        <Button onClick={handlePreview} disabled={loading} className="w-full">
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Önizleme Oluştur
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Right: Preview */}
            <div className="space-y-6">
                <Card className="h-full flex flex-col">
                    <CardHeader>
                        <CardTitle>3. Önizleme ve Onay</CardTitle>
                        <CardDescription>
                            Değişiklikleri kontrol edip onaylayın.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-auto min-h-[400px]">
                        {!previewResults ? (
                            <div className="flex items-center justify-center h-full text-muted-foreground p-8 text-center border-2 border-dashed rounded-lg">
                                İşlem detaylarını belirleyip "Önizleme Oluştur" butonuna tıklayın.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <Alert>
                                    <AlertTitle>Özet</AlertTitle>
                                    <AlertDescription>
                                        Toplam <strong>{previewResults.length}</strong> ürün etkilenecek.
                                    </AlertDescription>
                                </Alert>

                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Ürün</TableHead>
                                                <TableHead>Eski Fiyat</TableHead>
                                                <TableHead></TableHead>
                                                <TableHead>Yeni Fiyat</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {previewResults.slice(0, 50).map((p) => (
                                                <TableRow key={p.id}>
                                                    <TableCell className="max-w-[200px] truncate" title={p.name}>
                                                        <div className="font-medium">{p.name}</div>
                                                        <div className="text-xs text-muted-foreground">{p.sku}</div>
                                                    </TableCell>
                                                    <TableCell>{formatPrice(p.oldPrice)}</TableCell>
                                                    <TableCell>
                                                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                                    </TableCell>
                                                    <TableCell className="font-bold text-[#17457C]">
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
                                className="w-full bg-green-600 hover:bg-green-700"
                            >
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {previewResults.length} Ürünü Güncelle
                            </Button>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
