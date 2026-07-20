"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Search, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { createBrand, updateBrand, deleteBrand } from "@/app/admin/(protected)/brands/actions";
import { getTrendyolBrands } from "@/app/admin/(protected)/integrations/trendyol/actions";

// --- Trendyol Brand Search Component ---
interface TrendyolBrand { id: number; name: string; }

function TrendyolBrandSearch({
    value,
    onChange,
}: {
    value?: number;
    onChange: (id: number | undefined) => void;
}) {
    const [search, setSearch] = useState("");
    const [results, setResults] = useState<TrendyolBrand[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [selectedName, setSelectedName] = useState<string>("");
    const [error, setError] = useState<string>("");

    const handleSearch = async (q: string) => {
        setSearch(q);
        if (q.length < 2) { setResults([]); return; }
        setLoading(true);
        setError("");
        try {
            const res = await getTrendyolBrands(q);
            if (res.success && res.data) {
                const filtered = (res.data as TrendyolBrand[]).filter(b =>
                    b.name.toLowerCase().includes(q.toLowerCase())
                ).slice(0, 20);
                setResults(filtered);
                setOpen(true);
            } else {
                setError(res.message || "Markalar alınamadı. Trendyol entegrasyonunu kontrol edin.");
            }
        } catch {
            setError("Bağlantı hatası.");
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (brand: TrendyolBrand) => {
        onChange(brand.id);
        setSelectedName(brand.name);
        setSearch("");
        setResults([]);
        setOpen(false);
    };

    const handleClear = () => {
        onChange(undefined);
        setSelectedName("");
        setSearch("");
        setResults([]);
    };

    return (
        <div className="space-y-2">
            {value && selectedName ? (
                <div className="flex items-center gap-2 p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-sm">
                    <span className="font-medium text-orange-800 dark:text-orange-300 flex-1 truncate">✓ {selectedName}</span>
                    <span className="text-xs text-orange-600 font-mono">#{value}</span>
                    <button type="button" onClick={handleClear} className="text-orange-500 hover:text-red-600"><X className="w-4 h-4" /></button>
                </div>
            ) : value ? (
                <div className="flex items-center gap-2 p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-sm">
                    <span className="font-medium text-orange-800 dark:text-orange-300 flex-1">Mevcut ID: <span className="font-mono">#{value}</span></span>
                    <button type="button" onClick={handleClear} className="text-orange-500 hover:text-red-600"><X className="w-4 h-4" /></button>
                </div>
            ) : null}
            <div className="relative">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                        className="pl-8 border-orange-200"
                        placeholder="Marka adıyla arayın (min. 2 karakter)..."
                        value={search}
                        onChange={(e) => handleSearch(e.target.value)}
                    />
                    {loading && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-orange-500" />}
                </div>
                {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                {open && results.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-orange-200 rounded-lg shadow-xl">
                        {results.map((b) => (
                            <button key={b.id} type="button" onClick={() => handleSelect(b)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 dark:hover:bg-orange-900/20 flex items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                                <span className="truncate">{b.name}</span>
                                <span className="text-xs text-gray-400 font-mono shrink-0">#{b.id}</span>
                            </button>
                        ))}
                    </div>
                )}
                {open && results.length === 0 && search.length >= 2 && !loading && (
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-orange-200 rounded-lg shadow-xl p-3 text-sm text-gray-500 text-center">
                        Sonuç bulunamadı.
                    </div>
                )}
            </div>
        </div>
    );
}

interface Brand {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    isActive: boolean;
    trendyolBrandId?: number | null;
    n11BrandId?: number | null;
    hbBrandId?: string | null;
    idefixBrandId?: number | null;
    createdAt: Date;
    _count: {
        products: number;
    };
}

interface BrandsTableProps {
    brands: Brand[];
}

export function BrandsTable({ brands }: BrandsTableProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [editBrand, setEditBrand] = useState<Brand | null>(null);
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState("");
    const [logoUrl, setLogoUrl] = useState("");
    const [trendyolBrandId, setTrendyolBrandId] = useState<number | undefined>(undefined);
    const [n11BrandId, setN11BrandId] = useState<number | undefined>(undefined);
    const [hbBrandId, setHbBrandId] = useState<string | undefined>(undefined);
    const [idefixBrandId, setIdefixBrandId] = useState<number | undefined>(undefined);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (editBrand) {
                await updateBrand(editBrand.id, { name, logoUrl: logoUrl || undefined, trendyolBrandId, n11BrandId, hbBrandId, idefixBrandId });
                toast.success("Marka güncellendi.");
            } else {
                await createBrand({ name, logoUrl: logoUrl || undefined, trendyolBrandId, n11BrandId, hbBrandId, idefixBrandId });
                toast.success("Marka oluşturuldu.");
            }
            setIsOpen(false);
            resetForm();
        } catch {
            toast.error("Bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    // ... existing code ...

    const resetForm = () => {
        setName("");
        setLogoUrl("");
        setTrendyolBrandId(undefined);
        setN11BrandId(undefined);
        setHbBrandId(undefined);
        setIdefixBrandId(undefined);
        setEditBrand(null);
    };

    const openEditDialog = (brand: Brand) => {
        setEditBrand(brand);
        setName(brand.name);
        setLogoUrl(brand.logoUrl || "");
        setTrendyolBrandId(brand.trendyolBrandId ?? undefined);
        setN11BrandId(brand.n11BrandId ?? undefined);
        setHbBrandId(brand.hbBrandId ?? undefined);
        setIdefixBrandId(brand.idefixBrandId ?? undefined);
        setIsOpen(true);
    };

    const openNewDialog = () => {
        resetForm();
        setIsOpen(true);
    };

    const handleToggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            await updateBrand(id, { isActive: currentStatus });
            toast.success("Marka durumu güncellendi.");
        } catch {
            toast.error("Durum güncellenemedi.");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Bu markayı silmek istediğinize emin misiniz?")) return;

        try {
            await deleteBrand(id);
            toast.success("Marka silindi.");
        } catch {
            toast.error("Silme işlemi başarısız.");
        }
    };

    return (
        <>
            <div className="flex justify-end mb-4">
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={openNewDialog}>
                            <Plus className="h-4 w-4 mr-2" />
                            Yeni Marka
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>
                                {editBrand ? "Marka Düzenle" : "Yeni Marka"}
                            </DialogTitle>
                            <DialogDescription>
                                Marka bilgilerini girin
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit}>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Marka Adı</Label>
                                    <Input
                                        id="name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Örn: Apple"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="logoUrl">Logo URL (Opsiyonel)</Label>
                                    <Input
                                        id="logoUrl"
                                        value={logoUrl}
                                        onChange={(e) => setLogoUrl(e.target.value)}
                                        placeholder="https://..."
                                    />
                                </div>
                                <div className="space-y-2 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                                    <Label className="text-orange-700 dark:text-orange-400 font-semibold text-xs uppercase tracking-wide">🟠 Trendyol Marka ID</Label>
                                    <TrendyolBrandSearch
                                        value={trendyolBrandId}
                                        onChange={setTrendyolBrandId}
                                    />
                                </div>
                                <div className="space-y-2 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                                    <Label htmlFor="n11BrandId" className="text-purple-700 dark:text-purple-400 font-semibold text-xs uppercase tracking-wide">🟣 N11 Marka ID</Label>
                                    <Input
                                        id="n11BrandId"
                                        type="number"
                                        value={n11BrandId || ""}
                                        onChange={(e) => setN11BrandId(e.target.value ? Number(e.target.value) : undefined)}
                                        placeholder="N11 marka ID’si giriniz"
                                        className="border-purple-200 dark:border-purple-700"
                                    />
                                    <p className="text-[10px] text-purple-600">N11 marka ID’si giriniz.</p>
                                </div>
                                <div className="space-y-2 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                                    <Label htmlFor="idefixBrandId" className="text-purple-700 dark:text-purple-400 font-semibold text-xs uppercase tracking-wide">🟣 Idefix Marka ID</Label>
                                    <Input
                                        id="idefixBrandId"
                                        type="number"
                                        value={idefixBrandId || ""}
                                        onChange={(e) => setIdefixBrandId(e.target.value ? Number(e.target.value) : undefined)}
                                        placeholder="Idefix marka ID'si giriniz"
                                        className="border-purple-200 dark:border-purple-700"
                                    />
                                    <p className="text-[10px] text-purple-600">Idefix panelindeki Marka ID bilgisini girin.</p>
                                </div>
                                <div className="space-y-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                                    <Label htmlFor="hbBrandId" className="text-amber-700 dark:text-amber-400 font-semibold text-xs uppercase tracking-wide">🟡 Hepsiburada Marka</Label>
                                    <Input
                                        id="hbBrandId"
                                        value={hbBrandId || ""}
                                        onChange={(e) => setHbBrandId(e.target.value)}
                                        placeholder="Örn: Samsung"
                                        className="border-amber-200 dark:border-amber-700"
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                                    İptal
                                </Button>
                                <Button type="submit" disabled={loading}>
                                    {loading ? "Kaydediliyor..." : "Kaydet"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="rounded-lg border bg-white dark:bg-gray-800">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Logo</TableHead>
                            <TableHead>Marka Adı</TableHead>
                            <TableHead>Ürün Sayısı</TableHead>
                            <TableHead>Durum</TableHead>
                            <TableHead className="text-right">İşlemler</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {brands.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                                    Henüz marka bulunmuyor.
                                </TableCell>
                            </TableRow>
                        ) : (
                            brands.map((brand) => (
                                <TableRow key={brand.id}>
                                    <TableCell>
                                        {brand.logoUrl ? (
                                            <img
                                                src={brand.logoUrl}
                                                alt={brand.name}
                                                className="h-10 w-10 object-contain rounded"
                                            />
                                        ) : (
                                            <div className="h-10 w-10 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">
                                                Logo
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="font-medium">{brand.name}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">
                                            {brand._count.products} ürün
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Switch
                                            checked={brand.isActive}
                                            onCheckedChange={(checked) =>
                                                handleToggleStatus(brand.id, checked)
                                            }
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => openEditDialog(brand)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-red-600 hover:text-red-700"
                                                onClick={() => handleDelete(brand.id)}
                                                disabled={brand._count.products > 0}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </>
    );
}
