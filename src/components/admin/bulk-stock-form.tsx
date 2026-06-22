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
import { Loader2, ArrowRight } from "lucide-react";
import { previewBulkStockUpdate, executeBulkStockUpdate, StockPreviewResult } from "@/app/admin/(protected)/bulk-updates/actions";
import { toast } from "sonner";

interface BulkStockFormProps {
    categories: any[];
    brands: any[];
}

export function BulkStockForm({ categories, brands }: BulkStockFormProps) {
    // Selection State
    const [selectedBrand, setSelectedBrand] = useState<string>("ALL");
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [isAllCategories, setIsAllCategories] = useState(false);

    // Operation State
    const [operation, setOperation] = useState<"SET" | "INCREASE" | "DECREASE">("SET");
    const [value, setValue] = useState<string>("0");

    // Execution State
    const [loading, setLoading] = useState(false);
    const [previewResults, setPreviewResults] = useState<StockPreviewResult[] | null>(null);

    const handlePreview = async () => {
        if (!value || Number(value) < 0) {
            toast.error("Geçerli bir değer giriniz.");
            return;
        }

        setLoading(true);
        try {
            const results = await previewBulkStockUpdate(
                {
                    brandId: selectedBrand,
                    categoryId: isAllCategories ? "ALL" : (selectedCategories.length > 0 ? selectedCategories[0] : undefined),
                },
                {
                    operation,
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
        if (!confirm(`${previewResults.length} ürünün stoğu güncellenecek. Bu işlem geri alınamaz. Emin misiniz?`)) return;

        setLoading(true);
        try {
            await executeBulkStockUpdate(
                {
                    brandId: selectedBrand,
                    categoryId: isAllCategories ? "ALL" : (selectedCategories.length > 0 ? selectedCategories[0] : undefined),
                },
                {
                    operation,
                    value: Number(value),
                }
            );

            toast.success("Stoklar başarıyla güncellendi.");
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
                <Card>
                    <CardHeader>
                        <CardTitle>1. Hedef Seçimi</CardTitle>
                        <CardDescription>
                            Stok güncellemesi yapılacak ürün grubunu seçin.
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
                                        id="all-cats-stock"
                                        checked={isAllCategories}
                                        onCheckedChange={setIsAllCategories}
                                    />
                                    <Label htmlFor="all-cats-stock" className="text-xs font-normal cursor-pointer">
                                        Tüm Kategoriler
                                    </Label>
                                </div>
                            </div>

                            {!isAllCategories && (
                                <>
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
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>2. İşlem Detayları</CardTitle>
                        <CardDescription>
                            Uygulanacak stok değişikliğini belirleyin.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>İşlem Türü</Label>
                            <RadioGroup
                                value={operation}
                                onValueChange={(v: any) => setOperation(v)}
                                className="flex flex-col gap-2"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="SET" id="set" />
                                    <Label htmlFor="set">Miktara Eşitle (Örn: Hepsi 50 olsun)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="INCREASE" id="inc-stock" />
                                    <Label htmlFor="inc-stock">Miktarı Artır (Mevcuda ekle)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="DECREASE" id="dec-stock" />
                                    <Label htmlFor="dec-stock">Miktarı Azalt (Mevcuttan düş)</Label>
                                </div>
                            </RadioGroup>
                        </div>

                        <div className="space-y-2">
                            <Label>Değer (Adet)</Label>
                            <Input
                                type="number"
                                min="0"
                                step="1"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                            />
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
                                                <TableHead>Eski Stok</TableHead>
                                                <TableHead></TableHead>
                                                <TableHead>Yeni Stok</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {previewResults.slice(0, 50).map((p) => (
                                                <TableRow key={p.id}>
                                                    <TableCell className="max-w-[200px] truncate" title={p.name}>
                                                        <div className="font-medium">{p.name}</div>
                                                        <div className="text-xs text-muted-foreground">{p.sku}</div>
                                                    </TableCell>
                                                    <TableCell>{p.oldStock}</TableCell>
                                                    <TableCell>
                                                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                                    </TableCell>
                                                    <TableCell className="font-bold text-[#17457C]">
                                                        {p.newStock}
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
