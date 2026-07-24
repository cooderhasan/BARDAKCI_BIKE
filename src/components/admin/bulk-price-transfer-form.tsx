"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2, ArrowRight, ArrowLeftRight } from "lucide-react";
import { previewBulkPriceTransfer, executeBulkPriceTransfer, PriceTransferPreviewResult, PriceField, PriceTransferParams } from "@/app/admin/(protected)/bulk-updates/actions";
import { toast } from "sonner";
import { formatPrice } from "@/lib/helpers";

interface BulkPriceTransferFormProps {
    categories: any[];
    brands: any[];
}

const FIELD_LABELS: Record<PriceField, string> = {
    listPrice: "Ana E-Ticaret Fiyatı",
    salePrice: "İndirimli Fiyat",
    trendyolPrice: "Trendyol Fiyatı",
    n11Price: "N11 Fiyatı",
    hepsiburadaPrice: "Hepsiburada Fiyatı",
    idefixPrice: "Idefix Fiyatı",
    pazaramaPrice: "Pazarama Fiyatı"
};

const OP_LABELS: Record<PriceTransferParams["operation"], string> = {
    INCREASE_PERCENTAGE: "Yüzde Ekle (+%)",
    DECREASE_PERCENTAGE: "Yüzde Çıkar (-%)",
    INCREASE_FIXED: "Sabit Tutar Ekle (+TL)",
    DECREASE_FIXED: "Sabit Tutar Çıkar (-TL)",
    MULTIPLY: "Sabit Sayı ile Çarp (* X)",
    COPY: "Doğrudan Kopyala (Birebir)"
};

export function BulkPriceTransferForm({ categories, brands }: BulkPriceTransferFormProps) {
    // Target & Source Settings
    const [sourceField, setSourceField] = useState<PriceField>("trendyolPrice");
    const [targetField, setTargetField] = useState<PriceField>("hepsiburadaPrice");
    const [onlyEmptyTarget, setOnlyEmptyTarget] = useState(false);

    // Selection State
    const [selectedBrand, setSelectedBrand] = useState<string>("ALL");
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [isAllCategories, setIsAllCategories] = useState(true);

    // Operation State
    const [operation, setOperation] = useState<PriceTransferParams["operation"]>("MULTIPLY");
    const [value, setValue] = useState<string>("1");

    // Execution State
    const [loading, setLoading] = useState(false);
    const [previewResults, setPreviewResults] = useState<PriceTransferPreviewResult[] | null>(null);

    const generateInfoText = () => {
        const sourceName = FIELD_LABELS[sourceField];
        const targetName = FIELD_LABELS[targetField];
        let opDesc = "";
        
        switch (operation) {
            case "INCREASE_PERCENTAGE": opDesc = `%${value} ekleyip`; break;
            case "DECREASE_PERCENTAGE": opDesc = `%${value} çıkarıp`; break;
            case "INCREASE_FIXED": opDesc = `${value} TL ekleyip`; break;
            case "DECREASE_FIXED": opDesc = `${value} TL çıkarıp`; break;
            case "MULTIPLY": opDesc = `${value} ile çarpıp`; break;
            case "COPY": opDesc = `birebir kopyalayıp`; break;
        }

        return `Tüm ürünlerin ${sourceName} değerini baz alarak, bu fiyata ${opDesc} ${targetName} alanına yazılacaktır.`;
    };

    const handlePreview = async () => {
        if (operation !== "COPY" && (!value || Number(value) < 0)) {
            toast.error("Geçerli bir değer giriniz.");
            return;
        }

        setLoading(true);
        try {
            const results = await previewBulkPriceTransfer(
                {
                    brandId: selectedBrand,
                    categoryId: isAllCategories ? "ALL" : (selectedCategories.length > 0 ? selectedCategories[0] : undefined),
                    sourceField,
                    targetField,
                    onlyEmptyTarget
                },
                {
                    operation,
                    value: Number(value),
                }
            );

            if (results.length === 0) {
                toast.warning("Seçilen kriterlere uygun veya fiyatı değişecek ürün bulunamadı.");
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
        if (!confirm(`${previewResults.length} ürünün ${FIELD_LABELS[targetField]} güncellenecek. Emin misiniz?`)) return;

        setLoading(true);
        try {
            await executeBulkPriceTransfer(
                {
                    brandId: selectedBrand,
                    categoryId: isAllCategories ? "ALL" : (selectedCategories.length > 0 ? selectedCategories[0] : undefined),
                    sourceField,
                    targetField,
                    onlyEmptyTarget
                },
                {
                    operation,
                    value: Number(value),
                }
            );

            toast.success("Fiyat transferi başarıyla tamamlandı.");
            setPreviewResults(null);
        } catch (error) {
            toast.error("Güncelleme işlemi başarısız oldu.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid gap-6 lg:grid-cols-2">
            {/* Left: Configuration */}
            <div className="space-y-6">
                <Card className="border-emerald-200 dark:border-emerald-900">
                    <CardHeader className="bg-emerald-50/50 dark:bg-emerald-900/10">
                        <div className="flex items-center gap-2">
                            <ArrowLeftRight className="h-5 w-5 text-emerald-600" />
                            <CardTitle>Fiyat Transfer Ayarları</CardTitle>
                        </div>
                        <CardDescription>
                            Bir platformdaki fiyatları matematiksel işlem uygulayarak diğer platforma kopyalayın.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                        
                        <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border">
                            <div className="space-y-2">
                                <Label className="text-emerald-700 dark:text-emerald-400 font-bold">Kaynak Fiyat</Label>
                                <Select value={sourceField} onValueChange={(v: PriceField) => setSourceField(v)}>
                                    <SelectTrigger className="bg-white dark:bg-gray-900">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(FIELD_LABELS).map(([key, label]) => (
                                            <SelectItem key={key} value={key}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-orange-600 dark:text-orange-400 font-bold">Güncellenecek (Hedef)</Label>
                                <Select value={targetField} onValueChange={(v: PriceField) => setTargetField(v)}>
                                    <SelectTrigger className="bg-white dark:bg-gray-900">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(FIELD_LABELS).map(([key, label]) => (
                                            <SelectItem key={key} value={key}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Yapılacak İşlem</Label>
                                <Select value={operation} onValueChange={(v: any) => setOperation(v)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(OP_LABELS).map(([key, label]) => (
                                            <SelectItem key={key} value={key}>{label}</SelectItem>
                                        ))}
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
                                    disabled={operation === "COPY"}
                                />
                            </div>
                        </div>

                        <div className="p-4 bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/10 dark:border-yellow-900/30 rounded-xl space-y-3">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="empty-only" className="text-sm font-semibold cursor-pointer text-yellow-800 dark:text-yellow-400">
                                    Sadece Hedef Fiyatı Boş Olanları Güncelle
                                </Label>
                                <Switch
                                    id="empty-only"
                                    checked={onlyEmptyTarget}
                                    onCheckedChange={setOnlyEmptyTarget}
                                />
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                                Bu seçenek aktifken, halihazırda hedef fiyat alanında (Örn: Hepsiburada Fiyatı) veri girilmiş olan ürünler atlanır.
                            </p>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                            <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">İşlem Özeti</h4>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {generateInfoText()}
                            </p>
                        </div>

                        <div className="space-y-4 pt-4 border-t">
                            <div className="space-y-2">
                                <Label>Marka Filtresi</Label>
                                <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Tüm Markalar" />
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
                                    <Label>Kategori Filtresi</Label>
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            id="all-cats-transfer"
                                            checked={isAllCategories}
                                            onCheckedChange={setIsAllCategories}
                                        />
                                        <Label htmlFor="all-cats-transfer" className="text-xs font-normal cursor-pointer">
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
                        </div>

                        <Button onClick={handlePreview} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            İşlem Önizlemesini Hazırla
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Right: Preview */}
            <div className="space-y-6">
                <Card className="h-full flex flex-col border-emerald-100">
                    <CardHeader>
                        <CardTitle>Önizleme ve Onay</CardTitle>
                        <CardDescription>
                            Değişecek fiyatları kontrol edin ve onaylayın.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-auto min-h-[400px]">
                        {!previewResults ? (
                            <div className="flex items-center justify-center h-full text-muted-foreground p-8 text-center border-2 border-dashed rounded-lg border-emerald-100">
                                Ayarları yapıp "İşlem Önizlemesini Hazırla" butonuna tıklayın.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                                    <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                                        Toplam <strong>{previewResults.length}</strong> ürünün {FIELD_LABELS[targetField]} değeri güncellenecek.
                                    </p>
                                </div>

                                <div className="border rounded-md border-emerald-100">
                                    <Table>
                                        <TableHeader className="bg-emerald-50/50">
                                            <TableRow>
                                                <TableHead>Ürün / Barkod</TableHead>
                                                <TableHead>Kaynak<br/><span className="text-[9px] text-muted-foreground">{FIELD_LABELS[sourceField]}</span></TableHead>
                                                <TableHead>Eski Hedef<br/><span className="text-[9px] text-muted-foreground">{FIELD_LABELS[targetField]}</span></TableHead>
                                                <TableHead></TableHead>
                                                <TableHead>Yeni Hedef<br/><span className="text-[9px] text-emerald-600">Güncel Fiyat</span></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {previewResults.slice(0, 50).map((p) => (
                                                <TableRow key={p.id} className="hover:bg-emerald-50/10">
                                                    <TableCell className="max-w-[150px] truncate" title={p.name}>
                                                        <div className="font-medium text-xs">{p.name}</div>
                                                        <div className="text-[10px] text-muted-foreground font-mono">{p.barcode || p.sku}</div>
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">{formatPrice(p.sourcePrice)}</TableCell>
                                                    <TableCell className="text-xs text-red-500 line-through opacity-70">{formatPrice(p.oldTargetPrice)}</TableCell>
                                                    <TableCell>
                                                        <ArrowRight className="h-3 w-3 text-emerald-500" />
                                                    </TableCell>
                                                    <TableCell className="font-bold text-emerald-600 text-xs">
                                                        {formatPrice(p.newTargetPrice)}
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
                                className="w-full bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200 dark:shadow-none"
                            >
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {previewResults.length} Ürün İçin Transferi Başlat
                            </Button>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
