"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
    createCargoCompany,
    toggleCargoCompany,
    deleteCargoCompany,
    saveDesiPriceRanges,
    getDesiPriceRanges,
    toggleDesiActive,
} from "@/app/admin/(protected)/cargo-companies/actions";
import { Plus, Trash2, ChevronDown, ChevronUp, Save, Loader2 } from "lucide-react";

interface CargoCompany {
    id: string;
    name: string;
    isActive: boolean;
    isDesiActive: boolean;
}

interface DesiPriceRow {
    id?: string;
    minDesi: string;
    maxDesi: string;
    price: string;
    multiplierType: string;
}

interface CargoSettingsProps {
    initialCompanies: CargoCompany[];
}

export function CargoSettings({ initialCompanies }: CargoSettingsProps) {
    const [companies, setCompanies] = useState(initialCompanies);
    const [newName, setNewName] = useState("");
    const [isPending, startTransition] = useTransition();
    const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);
    const [desiRows, setDesiRows] = useState<DesiPriceRow[]>([]);
    const [desiLoading, setDesiLoading] = useState(false);
    const [desiSaving, setDesiSaving] = useState(false);

    const handleAdd = () => {
        if (!newName.trim()) return;
        const formData = new FormData();
        formData.set("name", newName);
        formData.set("isActive", "on");

        startTransition(async () => {
            const result = await createCargoCompany(formData);
            if (result.success) {
                toast.success("Kargo firması eklendi.");
                setNewName("");
                // Re-fetch will happen via revalidation
                window.location.reload();
            } else {
                toast.error(result.error);
            }
        });
    };

    const handleToggle = (id: string, currentState: boolean) => {
        startTransition(async () => {
            const result = await toggleCargoCompany(id, currentState);
            if (result.success) {
                setCompanies((prev) =>
                    prev.map((c) =>
                        c.id === id ? { ...c, isActive: !c.isActive } : c
                    )
                );
                toast.success("Durum güncellendi.");
            } else {
                toast.error(result.error);
            }
        });
    };

    const handleDesiToggle = (id: string, currentState: boolean) => {
        startTransition(async () => {
            const result = await toggleDesiActive(id, currentState);
            if (result.success) {
                setCompanies((prev) =>
                    prev.map((c) =>
                        c.id === id ? { ...c, isDesiActive: !c.isDesiActive } : c
                    )
                );
                toast.success("Desi hesaplama durumu güncellendi.");
            } else {
                toast.error(result.error);
            }
        });
    };

    const handleDelete = (id: string) => {
        if (!confirm("Bu kargo firmasını silmek istediğinizden emin misiniz?")) return;
        startTransition(async () => {
            const result = await deleteCargoCompany(id);
            if (result.success) {
                setCompanies((prev) => prev.filter((c) => c.id !== id));
                if (expandedCompanyId === id) {
                    setExpandedCompanyId(null);
                    setDesiRows([]);
                }
                toast.success("Kargo firması silindi.");
            } else {
                toast.error(result.error);
            }
        });
    };

    // Desi fiyat tablosu işlemleri
    const handleToggleDesiPanel = async (companyId: string) => {
        if (expandedCompanyId === companyId) {
            setExpandedCompanyId(null);
            setDesiRows([]);
            return;
        }

        setExpandedCompanyId(companyId);
        setDesiLoading(true);

        try {
            const ranges = await getDesiPriceRanges(companyId);
            if (ranges.length > 0) {
                setDesiRows(
                    ranges.map((r: any) => ({
                        id: r.id,
                        minDesi: String(r.minDesi),
                        maxDesi: String(r.maxDesi),
                        price: String(r.price),
                        multiplierType: r.multiplierType,
                    }))
                );
            } else {
                // Varsayılan satırlar
                setDesiRows([
                    { minDesi: "0.01", maxDesi: "5.99", price: "0", multiplierType: "FIXED" },
                ]);
            }
        } catch {
            toast.error("Desi fiyatları yüklenemedi.");
            setDesiRows([]);
        } finally {
            setDesiLoading(false);
        }
    };

    const handleAddDesiRow = () => {
        const lastRow = desiRows[desiRows.length - 1];
        const newMin = lastRow ? String((Number(lastRow.maxDesi) + 0.01).toFixed(2)) : "0.01";
        setDesiRows([
            ...desiRows,
            { minDesi: newMin, maxDesi: "", price: "0", multiplierType: "FIXED" },
        ]);
    };

    const handleRemoveDesiRow = (index: number) => {
        setDesiRows(desiRows.filter((_, i) => i !== index));
    };

    const handleDesiRowChange = (index: number, field: keyof DesiPriceRow, value: string) => {
        setDesiRows((prev) =>
            prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
        );
    };

    const handleSaveDesiRanges = async () => {
        if (!expandedCompanyId) return;

        // Validasyon
        for (let i = 0; i < desiRows.length; i++) {
            const row = desiRows[i];
            if (!row.minDesi || !row.maxDesi || !row.price) {
                toast.error(`Satır ${i + 1}: Tüm alanlar doldurulmalıdır.`);
                return;
            }
            if (Number(row.minDesi) > Number(row.maxDesi)) {
                toast.error(`Satır ${i + 1}: Başlangıç desi, bitiş desiden büyük olamaz.`);
                return;
            }
            if (Number(row.price) < 0) {
                toast.error(`Satır ${i + 1}: Ücret negatif olamaz.`);
                return;
            }
        }

        setDesiSaving(true);
        try {
            const result = await saveDesiPriceRanges(
                expandedCompanyId,
                desiRows.map((r: DesiPriceRow) => ({
                    minDesi: Number(r.minDesi),
                    maxDesi: Number(r.maxDesi),
                    price: Number(r.price),
                    multiplierType: r.multiplierType,
                }))
            );

            if (result.success) {
                toast.success("Desi fiyatları kaydedildi.");
            } else {
                toast.error(result.error);
            }
        } catch {
            toast.error("Kaydetme sırasında hata oluştu.");
        } finally {
            setDesiSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <Label className="text-base font-semibold">Kargo Firmaları</Label>

            {/* Yeni Kargo Firması Ekle */}
            <div className="flex gap-2">
                <Input
                    placeholder="Yeni kargo firması adı"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
                <Button onClick={handleAdd} disabled={isPending || !newName.trim()} size="sm">
                    <Plus className="h-4 w-4 mr-1" /> Ekle
                </Button>
            </div>

            {/* Kargo Firmaları Listesi */}
            <div className="space-y-2">
                {companies.map((company) => (
                    <div key={company.id} className="border rounded-lg overflow-hidden">
                        {/* Firma Başlık Satırı */}
                        <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-900">
                            <button
                                type="button"
                                onClick={() => handleToggleDesiPanel(company.id)}
                                className="flex items-center gap-2 text-sm font-medium hover:text-[#17457C] transition-colors"
                            >
                                {expandedCompanyId === company.id ? (
                                    <ChevronUp className="h-4 w-4" />
                                ) : (
                                    <ChevronDown className="h-4 w-4" />
                                )}
                                {company.name}
                                <span className="text-xs text-gray-400 font-normal">
                                    (Desi fiyat tablosu için tıklayın)
                                </span>
                            </button>

                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <Label className="text-[10px] text-gray-500 uppercase font-bold">Aktif</Label>
                                    <Switch
                                        checked={company.isActive}
                                        onCheckedChange={() => handleToggle(company.id, company.isActive)}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Label className="text-[10px] text-blue-500 uppercase font-bold">Desi Aktif</Label>
                                    <Switch
                                        checked={company.isDesiActive}
                                        onCheckedChange={() => handleDesiToggle(company.id, company.isDesiActive)}
                                    />
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(company.id)}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Desi Fiyat Tablosu — Açılır Panel */}
                        {expandedCompanyId === company.id && (
                            <div className="border-t bg-gray-50 dark:bg-gray-800/50 p-4 space-y-4">
                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                                    <p className="text-sm text-blue-800 dark:text-blue-200">
                                        <strong>Ağırlık Oranlı Kargo Desi Tanımlamaları</strong><br />
                                        Ürünlerin desi ile ağırlık karşılaştırılarak yüksek olan değere göre işlem sağlanmaktadır.
                                        Desi ve ücret bilgilerini &ldquo;.&rdquo; ile ayırarak yazınız.
                                    </p>
                                </div>

                                {desiLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                                    </div>
                                ) : (
                                    <>
                                        {/* Tablo Başlıkları */}
                                        <div className="grid grid-cols-[1fr_1fr_1fr_140px_40px] gap-2 text-xs font-semibold text-gray-500 uppercase px-1">
                                            <span>Başlangıç Desi</span>
                                            <span>Bitiş Desi</span>
                                            <span>Ücret (TL)</span>
                                            <span>Çarpan</span>
                                            <span></span>
                                        </div>

                                        {/* Tablo Satırları */}
                                        {desiRows.map((row, index) => (
                                            <div
                                                key={index}
                                                className="grid grid-cols-[1fr_1fr_1fr_140px_40px] gap-2 items-center"
                                            >
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={row.minDesi}
                                                    onChange={(e) =>
                                                        handleDesiRowChange(index, "minDesi", e.target.value)
                                                    }
                                                    placeholder="0.01"
                                                    className="h-9"
                                                />
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={row.maxDesi}
                                                    onChange={(e) =>
                                                        handleDesiRowChange(index, "maxDesi", e.target.value)
                                                    }
                                                    placeholder="5.99"
                                                    className="h-9"
                                                />
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={row.price}
                                                    onChange={(e) =>
                                                        handleDesiRowChange(index, "price", e.target.value)
                                                    }
                                                    placeholder="118.00"
                                                    className="h-9"
                                                />
                                                <select
                                                    value={row.multiplierType}
                                                    onChange={(e) =>
                                                        handleDesiRowChange(index, "multiplierType", e.target.value)
                                                    }
                                                    className="h-9 border rounded-md px-2 text-sm bg-white dark:bg-gray-900 dark:border-gray-700"
                                                >
                                                    <option value="FIXED">Sabit Değer</option>
                                                    <option value="MULTIPLY">Katsayı ile Çarp</option>
                                                </select>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleRemoveDesiRow(index)}
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 h-9 w-9 p-0"
                                                    disabled={desiRows.length === 1}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}

                                        {/* Alt Butonlar */}
                                        <div className="flex items-center justify-between pt-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={handleAddDesiRow}
                                                className="text-green-600 border-green-300 hover:bg-green-50"
                                            >
                                                <Plus className="h-4 w-4 mr-1" /> Yeni Desi Tanımla
                                            </Button>

                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={handleSaveDesiRanges}
                                                disabled={desiSaving}
                                                className="bg-[#17457C] hover:bg-[#0f3460]"
                                            >
                                                {desiSaving ? (
                                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                                ) : (
                                                    <Save className="h-4 w-4 mr-1" />
                                                )}
                                                Kaydet
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {companies.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                        Henüz kargo firması eklenmemiş.
                    </p>
                )}
            </div>
        </div>
    );
}
