"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Upload,
    FileSpreadsheet,
    Download,
    ArrowLeft,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Loader2
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { parseExcelFile, importProducts } from "./actions";

export default function ProductImportPage() {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [preview, setPreview] = useState<any[]>([]);
    const [errors, setErrors] = useState<{ row: number; message: string }[]>([]);
    const [result, setResult] = useState<{ created: number; updated: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setLoading(true);
        setResult(null);
        setErrors([]);

        const formData = new FormData();
        formData.append("file", selectedFile);

        try {
            const parseResult = await parseExcelFile(formData);
            setPreview(parseResult.rows.slice(0, 10)); // Show first 10 rows
            setErrors(parseResult.errors);

            if (parseResult.errors.length === 0 && parseResult.rows.length > 0) {
                toast.success(`${parseResult.rows.length} ürün okundu, import için hazır.`);
            } else if (parseResult.errors.length > 0) {
                toast.error(`${parseResult.errors.length} hata bulundu. Lütfen düzeltin.`);
            }
        } catch (error) {
            toast.error("Dosya okunamadı");
            setPreview([]);
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async () => {
        if (!file) return;

        setImporting(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const importResult = await importProducts(formData);
            setResult({ created: importResult.created, updated: importResult.updated });
            setErrors(importResult.errors);

            if (importResult.success) {
                toast.success(`Import tamamlandı: ${importResult.created} eklendi, ${importResult.updated} güncellendi`);
            } else {
                toast.warning(`Import kısmen tamamlandı. ${importResult.errors.length} hata.`);
            }
        } catch (error) {
            toast.error("Import sırasında hata oluştu");
        } finally {
            setImporting(false);
        }
    };

    const resetImport = () => {
        setFile(null);
        setPreview([]);
        setErrors([]);
        setResult(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Upload className="h-6 w-6 text-[#17457C]" />
                        Toplu Ürün Yükleme
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400">
                        Excel dosyası ile ürün ekleyin veya güncelleyin
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link href="/api/products/template">
                        <Button variant="outline">
                            <Download className="h-4 w-4 mr-2" />
                            Şablon İndir
                        </Button>
                    </Link>
                    <Link href="/admin/products">
                        <Button variant="outline">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Ürünler
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Instructions */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Kullanım Talimatları</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-[#17457C] flex items-center justify-center font-bold text-sm">1</div>
                            <div>
                                <p className="font-medium">Şablonu İndirin</p>
                                <p className="text-sm text-gray-500">Excel şablon dosyasını indirip ürün bilgilerini doldurun</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-[#17457C] flex items-center justify-center font-bold text-sm">2</div>
                            <div>
                                <p className="font-medium">Dosyayı Yükleyin</p>
                                <p className="text-sm text-gray-500">Doldurduğunuz Excel dosyasını yükleyin ve önizleyin</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-[#17457C] flex items-center justify-center font-bold text-sm">3</div>
                            <div>
                                <p className="font-medium">Import Edin</p>
                                <p className="text-sm text-gray-500">Hata yoksa import butonuna tıklayın</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                        <div className="text-sm">
                            <p className="font-medium text-amber-800">Önemli Notlar:</p>
                            <ul className="text-amber-700 mt-1 space-y-1 list-disc list-inside">
                                <li>Stok kodu (SKU) mevcut bir ürünle eşleşirse, o ürün güncellenir</li>
                                <li>Kategori ve marka slug'ları sistemde tanımlı olmalıdır</li>
                                <li>Fiyatlar ondalık (örn: 100.50) olarak girilmelidir</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* File Upload */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Dosya Yükle</CardTitle>
                </CardHeader>
                <CardContent>
                    {!file ? (
                        <label className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-12 hover:bg-gray-50 transition-colors">
                            <FileSpreadsheet className="h-12 w-12 text-gray-400 mb-4" />
                            <p className="font-medium text-gray-700">Excel dosyasını seçin veya sürükleyin</p>
                            <p className="text-sm text-gray-500 mt-1">.xlsx veya .xls dosyaları</p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                        </label>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <FileSpreadsheet className="h-8 w-8 text-green-600" />
                                    <div>
                                        <p className="font-medium">{file.name}</p>
                                        <p className="text-sm text-gray-500">
                                            {preview.length > 0 && `${preview.length}+ ürün bulundu`}
                                        </p>
                                    </div>
                                </div>
                                <Button variant="outline" onClick={resetImport}>
                                    Değiştir
                                </Button>
                            </div>

                            {/* Result Summary */}
                            {result && (
                                <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                                    <CheckCircle className="h-6 w-6 text-green-600" />
                                    <div>
                                        <p className="font-medium text-green-800">Import Tamamlandı</p>
                                        <p className="text-sm text-green-700">
                                            {result.created} ürün eklendi, {result.updated} ürün güncellendi
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Errors */}
                            {errors.length > 0 && (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <XCircle className="h-5 w-5 text-red-600" />
                                        <p className="font-medium text-red-800">{errors.length} Hata Bulundu</p>
                                    </div>
                                    <ul className="text-sm text-red-700 space-y-1 max-h-40 overflow-auto">
                                        {errors.map((error, i) => (
                                            <li key={i}>Satır {error.row}: {error.message}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Import Button */}
                            {!result && preview.length > 0 && errors.length === 0 && (
                                <Button
                                    onClick={handleImport}
                                    disabled={importing}
                                    className="w-full"
                                    size="lg"
                                >
                                    {importing ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Import Ediliyor...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="h-4 w-4 mr-2" />
                                            {preview.length} Ürünü Import Et
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Preview Table */}
            {preview.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Önizleme (İlk 10 Satır)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Ürün Adı</TableHead>
                                        <TableHead>Fiyat</TableHead>
                                        <TableHead>Kategori</TableHead>
                                        <TableHead>Stok Kodu</TableHead>
                                        <TableHead>Stok</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {preview.map((row, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-medium">
                                                {row["Ürün Adı (Zorunlu)"]}
                                            </TableCell>
                                            <TableCell>
                                                {row["Liste Fiyatı (Zorunlu)"]}
                                            </TableCell>
                                            <TableCell>
                                                {row["Kategori Slug (Zorunlu)"]}
                                            </TableCell>
                                            <TableCell className="text-gray-500">
                                                {row["Stok Kodu"] || "-"}
                                            </TableCell>
                                            <TableCell>
                                                {row["Stok Adedi"] ?? 0}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
