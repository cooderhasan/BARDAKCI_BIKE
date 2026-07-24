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

// --- Pazarama Brand Search Component ---
interface PazaramaBrand { id: string; name: string; }

function PazaramaBrandSearch({
    value,
    onChange,
}: {
    value?: string | number;
    onChange: (id: string | undefined) => void;
}) {
    const [search, setSearch] = useState(String(value || ""));
    const [allBrands, setAllBrands] = useState<PazaramaBrand[]>([]);
    const [results, setResults] = useState<PazaramaBrand[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);

    const fetchBrands = async () => {
        if (allBrands.length > 0) return allBrands;
        setLoading(true);
        try {
            const { getPazaramaBrands } = await import("@/app/admin/(protected)/integrations/pazarama/actions");
            const res = await getPazaramaBrands();
            if (res.success && res.data && res.data.length > 0) {
                setAllBrands(res.data);
                return res.data;
            }
            return [];
        } catch {
            return [];
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (q: string) => {
        setSearch(q);
        onChange(q ? q : undefined);
        if (q.length < 2) { setResults([]); setOpen(false); return; }
        const brands = await fetchBrands();
        const filtered = brands.filter((b: PazaramaBrand) => b.name.toLowerCase().includes(q.toLowerCase()) || b.id.toLowerCase().includes(q.toLowerCase())).slice(0, 50);
        setResults(filtered);
        setOpen(filtered.length > 0);
    };

    const handleSelect = (brand: PazaramaBrand) => {
        onChange(brand.id);
        setSearch(brand.id);
        setResults([]);
        setOpen(false);
    };

    const handleClear = () => {
        onChange(undefined);
        setSearch("");
        setResults([]);
        setOpen(false);
    };

    return (
        <div className="space-y-1.5">
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                    className="pl-8 pr-8 border-pink-200 focus-visible:ring-pink-500 text-xs font-mono"
                    placeholder="Pazarama Marka ID giriniz veya adı ile arayınız..."
                    value={search}
                    onChange={(e) => handleSearch(e.target.value)}
                />
                {loading && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-pink-500" />}
                {search && !loading && (
                    <button type="button" onClick={handleClear} className="absolute right-2.5 top-2.5 text-gray-400 hover:text-red-500">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {open && results.length > 0 && (
                <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-pink-200 rounded-lg shadow-xl">
                    {results.map((b) => (
                        <button
                            key={b.id}
                            type="button"
                            onClick={() => handleSelect(b)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-pink-50 dark:hover:bg-pink-900/20 flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
                        >
                            <span className="font-medium text-gray-800 dark:text-gray-200">{b.name}</span>
                            <span className="text-[10px] text-pink-600 font-mono shrink-0">#{b.id}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

interface Brand {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    store?: "BIKE" | "MOTOR" | "BOTH";
    isActive: boolean;
    trendyolBrandId?: number | null;
    n11BrandId?: number | null;
    hbBrandId?: string | null;
    idefixBrandId?: string | number | null;
    pazaramaBrandId?: string | number | null;
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
    const [store, setStore] = useState<"BIKE" | "MOTOR" | "BOTH">("BIKE");
    const [trendyolBrandId, setTrendyolBrandId] = useState<number | undefined>(undefined);
    const [n11BrandId, setN11BrandId] = useState<number | undefined>(undefined);
    const [hbBrandId, setHbBrandId] = useState<string | undefined>(undefined);
    const [idefixBrandId, setIdefixBrandId] = useState<number | undefined>(undefined);
    const [pazaramaBrandId, setPazaramaBrandId] = useState<string | undefined>(undefined);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (editBrand) {
                await updateBrand(editBrand.id, { name, logoUrl: logoUrl || undefined, store, trendyolBrandId, n11BrandId, hbBrandId, idefixBrandId, pazaramaBrandId });
                toast.success("Marka güncellendi.");
            } else {
                await createBrand({ name, logoUrl: logoUrl || undefined, store, trendyolBrandId, n11BrandId, hbBrandId, idefixBrandId, pazaramaBrandId });
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

    const resetForm = () => {
        setName("");
        setLogoUrl("");
        setStore("BIKE");
        setTrendyolBrandId(undefined);
        setN11BrandId(undefined);
        setHbBrandId(undefined);
        setIdefixBrandId(undefined);
        setPazaramaBrandId(undefined);
        setEditBrand(null);
    };

    const openEditDialog = (brand: Brand) => {
        setEditBrand(brand);
        setName(brand.name);
        setLogoUrl(brand.logoUrl || "");
        setStore(brand.store || "BIKE");
        setTrendyolBrandId(brand.trendyolBrandId ?? undefined);
        setN11BrandId(brand.n11BrandId ?? undefined);
        setHbBrandId(brand.hbBrandId ?? undefined);
        setIdefixBrandId(brand.idefixBrandId ? Number(brand.idefixBrandId) : undefined);
        setPazaramaBrandId(brand.pazaramaBrandId ? String(brand.pazaramaBrandId) : undefined);
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
                                <div className="space-y-2 p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                    <Label htmlFor="brandStore" className="text-emerald-800 dark:text-emerald-300 font-bold text-xs uppercase tracking-wide">🏪 Mağaza Yayın Alanı</Label>
                                    <select
                                        id="brandStore"
                                        className="w-full h-10 px-3 rounded-md border border-emerald-300 bg-white dark:bg-gray-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        value={store}
                                        onChange={(e) => setStore(e.target.value as any)}
                                    >
                                        <option value="BIKE">🚲 Sadece Bardakcı Bisiklet</option>
                                        <option value="MOTOR">🏍️ Sadece Motovitrin</option>
                                        <option value="BOTH">🌐 Her İki Mağazada Ortak</option>
                                    </select>
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
                                <div className="space-y-2 p-3 bg-pink-50 dark:bg-pink-950/20 rounded-lg border border-pink-200 dark:border-pink-800">
                                    <Label className="text-pink-700 dark:text-pink-400 font-semibold text-xs uppercase tracking-wide">🌸 Pazarama Marka Eşleştirme</Label>
                                    <PazaramaBrandSearch
                                        value={pazaramaBrandId}
                                        onChange={setPazaramaBrandId}
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
                            <TableHead>Mağaza</TableHead>
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
                                        {brand.store === "BIKE" && (
                                            <Badge className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-100 font-semibold">🚲 Bisiklet</Badge>
                                        )}
                                        {brand.store === "MOTOR" && (
                                            <Badge className="bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-100 font-semibold">🏍️ Motor</Badge>
                                        )}
                                        {brand.store === "BOTH" && (
                                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-100 font-semibold">🌐 Ortak</Badge>
                                        )}
                                    </TableCell>
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
