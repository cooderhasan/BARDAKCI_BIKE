"use client";

import { useState, useEffect, useRef } from "react";
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
import { X, Plus, Pencil, Trash2, Search, Loader2, Check, ChevronsUpDown, Eye, ExternalLink, ArrowRight, FolderSync } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getTrendyolCategories } from "@/app/admin/(protected)/integrations/trendyol/actions";
import { getFlatN11Categories } from "@/app/admin/(protected)/integrations/n11/actions";
import { getHepsiburadaCategories } from "@/app/admin/(protected)/integrations/hepsiburada/actions";
import { getIdefixCategories } from "@/app/admin/(protected)/integrations/idefix/actions";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { createCategory, updateCategory, deleteCategory, toggleCategoryStatus, updateCategoriesSidebarOrder, updateCategoriesHeaderOrder, getCategoryProductsAction, moveProductToCategoryAction, moveAllProductsAndMergeCategoryAction } from "@/app/admin/(protected)/categories/actions";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { searchHepsiburadaCategories } from "@/app/admin/(protected)/integrations/hepsiburada/actions";
import { CiceksepetiAttributeMappingModal } from "@/components/admin/ciceksepeti-attribute-mapping-modal";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

interface Category {
    id: string;
    name: string;
    slug: string;
    store?: "BIKE" | "MOTOR" | "BOTH";
    order: number;
    isActive: boolean;
    createdAt: Date;
    parentId?: string | null;
    imageUrl?: string | null;
    menuImageUrl?: string | null;
    isInHeader: boolean;
    headerOrder: number;
    isFeatured: boolean;
    trendyolCategoryId?: number | null;
    n11CategoryId?: number | null;
    pttavmCategoryId?: number | null;
    hbCategoryId?: string | null;
    idefixCategoryId?: string | number | null;
    pazaramaCategoryId?: string | number | null;
    ciceksepetiCategoryId?: string | number | null;
    googleProductCategory?: string | null;
    description?: string | null;
    parent?: {
        name: string;
    } | null;
    _count: {
        products: number;
    };
}

interface SortableRowProps {
    category: Category;
    onEdit: (category: Category) => void;
    onDelete: (id: string) => void;
    onToggleStatus: (id: string, isActive: boolean) => void;
    onInspectProducts?: (category: Category) => void;
    reorderMode: "none" | "sidebar" | "header";
}

function SortableRow({ category, onEdit, onDelete, onToggleStatus, onInspectProducts, reorderMode }: SortableRowProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: category.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 0,
        position: "relative" as const,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <TableRow ref={setNodeRef} style={style}>
            <TableCell className="w-[80px]">
                {reorderMode !== "none" ? (
                    <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
                        <GripVertical className="h-4 w-4 text-gray-400" />
                    </div>
                ) : (
                    category.order
                )}
            </TableCell>
            <TableCell>
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                        <span className="font-medium">{category.name}</span>
                        {category.store === "MOTOR" ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">🏍️ Motor</span>
                        ) : category.store === "BOTH" ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">🌐 Ortak</span>
                        ) : (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">🚲 Bisiklet</span>
                        )}
                    </div>
                    {category.parent && (
                        <span className="text-xs text-gray-400">
                            ↳ {category.parent.name}
                        </span>
                    )}
                </div>
            </TableCell>
            <TableCell className="text-gray-500">{category.slug}</TableCell>
            <TableCell>
                {reorderMode === "header" ? (
                    <Badge variant={category.isInHeader ? "default" : "secondary"}>
                        {category.isInHeader ? "Üst Menüde" : "Değil"}
                    </Badge>
                ) : (
                    <button
                        type="button"
                        onClick={() => onInspectProducts?.(category)}
                        className="group focus:outline-none"
                        title="Bağlı ürünleri görüntüle ve düzenle"
                    >
                        <Badge
                            variant="secondary"
                            className="cursor-pointer hover:bg-blue-100 hover:text-blue-800 dark:hover:bg-blue-900/40 dark:hover:text-blue-200 transition-all font-medium py-1 px-2.5 flex items-center gap-1.5 shadow-sm border border-gray-200 dark:border-gray-700"
                        >
                            <Eye className="w-3.5 h-3.5 text-gray-500 group-hover:text-blue-600" />
                            <span>{category._count.products} ürün</span>
                        </Badge>
                    </button>
                )}
            </TableCell>
            <TableCell>
                <div className="flex gap-2">
                    <div title={category.trendyolCategoryId ? "Trendyol Bağlı" : "Trendyol Bağlı Değil"}>
                        <div className={`w-2 h-2 rounded-full ${category.trendyolCategoryId ? "bg-orange-500" : "bg-gray-200"}`} />
                    </div>
                    <div title={category.n11CategoryId ? "N11 Bağlı" : "N11 Bağlı Değil"}>
                        <div className={`w-2 h-2 rounded-full ${category.n11CategoryId ? "bg-purple-500" : "bg-gray-200"}`} />
                    </div>
                    <div title={category.pttavmCategoryId ? "ePttAVM Bağlı" : "ePttAVM Bağlı Değil"}>
                        <div className={`w-2 h-2 rounded-full ${category.pttavmCategoryId ? "bg-teal-500" : "bg-gray-200"}`} />
                    </div>
                    <div title={category.hbCategoryId ? "Hepsiburada Bağlı" : "Hepsiburada Bağlı Değil"}>
                        <div className={`w-2 h-2 rounded-full ${category.hbCategoryId ? "bg-orange-600" : "bg-gray-200"}`} />
                    </div>
                    <div title={category.idefixCategoryId ? "Idefix Bağlı" : "Idefix Bağlı Değil"}>
                        <div className={`w-2 h-2 rounded-full ${category.idefixCategoryId ? "bg-purple-600" : "bg-gray-200"}`} />
                    </div>
                    <div title={category.pazaramaCategoryId ? "Pazarama Bağlı" : "Pazarama Bağlı Değil"}>
                        <div className={`w-2 h-2 rounded-full ${category.pazaramaCategoryId ? "bg-pink-600" : "bg-gray-200"}`} />
                    </div>
                    <div title={category.ciceksepetiCategoryId ? "Çiçeksepeti Bağlı" : "Çiçeksepeti Bağlı Değil"}>
                        <div className={`w-2 h-2 rounded-full ${category.ciceksepetiCategoryId ? "bg-rose-600" : "bg-gray-200"}`} />
                    </div>
                </div>
            </TableCell>
            <TableCell>
                <Switch
                    checked={category.isActive}
                    onCheckedChange={(checked) =>
                        onToggleStatus(category.id, checked)
                    }
                    disabled={reorderMode !== "none"}
                />
            </TableCell>
            <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(category)}
                        disabled={reorderMode !== "none"}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => onDelete(category.id)}
                        disabled={reorderMode !== "none" || category._count.products > 0}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );
}

interface CategoriesTableProps {
    categories: Category[];
}

function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ş/g, "s")
        .replace(/ı/g, "i")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

// --- Trendyol Category Search Component ---
interface TrendyolCategory {
    id: number;
    name: string;
    parentId?: number | null;
}

function TrendyolCategorySearch({
    value,
    onChange,
}: {
    value?: number;
    onChange: (id: number | undefined) => void;
}) {
    const [search, setSearch] = useState("");
    const [results, setResults] = useState<TrendyolCategory[]>([]);
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
            const res = await getTrendyolCategories();
            if (res.success && res.data) {
                const filtered = (res.data as TrendyolCategory[]).filter(c =>
                    c.name.toLowerCase().includes(q.toLowerCase())
                ).slice(0, 100);
                setResults(filtered);
                setOpen(true);
            } else {
                setError(res.message || "Kategoriler alınamadı. Trendyol entegrasyonunu kontrol edin.");
            }
        } catch {
            setError("Bağlantı hatası.");
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (cat: TrendyolCategory) => {
        onChange(cat.id);
        setSelectedName(cat.name);
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
                    <button type="button" onClick={handleClear} className="text-orange-500 hover:text-red-600">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ) : value ? (
                <div className="flex items-center gap-2 p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-sm">
                    <span className="font-medium text-orange-800 dark:text-orange-300 flex-1">Mevcut ID: <span className="font-mono">#{value}</span></span>
                    <button type="button" onClick={handleClear} className="text-orange-500 hover:text-red-600">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ) : null}

            <div className="relative">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                        className="pl-8 border-orange-200"
                        placeholder="Kategori adıyla arayın (min. 2 karakter)..."
                        value={search}
                        onChange={(e) => handleSearch(e.target.value)}
                    />
                    {loading && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-orange-500" />}
                </div>

                {error && (
                    <p className="text-xs text-red-500 mt-1">{error}</p>
                )}

                {open && results.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-orange-200 rounded-lg shadow-xl">
                        {results.map((cat) => (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => handleSelect(cat)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 dark:hover:bg-orange-900/20 flex items-start justify-between gap-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
                            >
                                <span className="whitespace-normal leading-relaxed text-xs">{cat.name}</span>
                                <span className="text-xs text-gray-400 font-mono shrink-0 pt-0.5">#{cat.id}</span>
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

// --- N11 Category Search Component ---
interface N11Category {
    id: number;
    name: string;
}

function N11CategorySearch({
    value,
    onChange,
}: {
    value?: number;
    onChange: (id: number | undefined) => void;
}) {
    const [search, setSearch] = useState("");
    const [results, setResults] = useState<N11Category[]>([]);
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
            const res = await getFlatN11Categories();
            if (res.success && res.categories) {
                const filtered = (res.categories as N11Category[]).filter(c =>
                    c.name.toLowerCase().includes(q.toLowerCase())
                ).slice(0, 100);
                setResults(filtered);
                setOpen(true);
            } else {
                setError(res.message || "Kategoriler alınamadı. N11 entegrasyonunu kontrol edin.");
            }
        } catch {
            setError("Bağlantı hatası.");
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (cat: N11Category) => {
        onChange(cat.id);
        setSelectedName(cat.name);
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
                <div className="flex items-center gap-2 p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-sm">
                    <span className="font-medium text-purple-800 dark:text-purple-300 flex-1 truncate">✓ {selectedName}</span>
                    <span className="text-xs text-purple-600 font-mono">#{value}</span>
                    <button type="button" onClick={handleClear} className="text-purple-500 hover:text-red-600">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ) : value ? (
                <div className="flex items-center gap-2 p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-sm">
                    <span className="font-medium text-purple-800 dark:text-purple-300 flex-1">Mevcut ID: <span className="font-mono">#{value}</span></span>
                    <button type="button" onClick={handleClear} className="text-purple-500 hover:text-red-600">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ) : null}

            <div className="relative">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                        className="pl-8 border-purple-200 focus-visible:ring-purple-500"
                        placeholder="N11 kategorisi ara (min. 2 karakter)..."
                        value={search}
                        onChange={(e) => handleSearch(e.target.value)}
                    />
                    {loading && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-purple-500" />}
                </div>

                {error && (
                    <p className="text-xs text-red-500 mt-1">{error}</p>
                )}

                {open && results.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-purple-200 rounded-lg shadow-xl">
                        {results.map((cat) => (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => handleSelect(cat)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 dark:hover:bg-purple-900/20 flex items-start justify-between gap-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
                            >
                                <span className="whitespace-normal leading-relaxed text-xs">{cat.name}</span>
                                <span className="text-xs text-gray-400 font-mono shrink-0 pt-0.5">#{cat.id}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// --- Hepsiburada Category Search Component ---
interface HepsiburadaCategory {
    categoryId: string;
    name: string;
    paths?: string[];
}

function HepsiburadaCategorySearch({
    value,
    onChange,
}: {
    value?: string;
    onChange: (id: string | undefined) => void;
}) {
    const [search, setSearch] = useState("");
    const [results, setResults] = useState<HepsiburadaCategory[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [selectedName, setSelectedName] = useState<string>("");
    const [error, setError] = useState<string>("");

    const [isManual, setIsManual] = useState(false);
    const [manualId, setManualId] = useState("");

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleSearch = (q: string) => {
        setSearch(q);
        if (q.length < 2) { setResults([]); setOpen(false); return; }

        // Debounce 300ms
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            setError("");
            try {
                const res = await searchHepsiburadaCategories(q);
                if (res.success && res.data) {
                    setResults(res.data as HepsiburadaCategory[]);
                    setOpen(true);
                } else {
                    setError(res.message || "Kategoriler alınamadı.");
                }
            } catch (error) {
                console.error("Search error:", error);
                setError("Bağlantı hatası.");
            } finally {
                setLoading(false);
            }
        }, 300);
    };

    const handleSelect = (cat: HepsiburadaCategory) => {
        onChange(String(cat.categoryId));
        setSelectedName(cat.name);
        setSearch("");
        setResults([]);
        setOpen(false);
    };

    const handleClear = () => {
        onChange(undefined);
        setSelectedName("");
        setSearch("");
        setResults([]);
        setManualId("");
    };

    const handleManualSubmit = () => {
        if (manualId) {
            onChange(manualId);
            setSelectedName("Manuel Tanımlanan Kategori");
            setIsManual(false);
        }
    };

    return (
        <div className="space-y-2">
            {value && selectedName ? (
                <div className="flex items-center gap-2 p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-sm">
                    <span className="font-medium text-orange-800 dark:text-orange-300 flex-1 truncate">✓ {selectedName}</span>
                    <span className="text-xs text-orange-600 font-mono">#{value}</span>
                    <button type="button" onClick={handleClear} className="text-orange-500 hover:text-red-600">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ) : value ? (
                <div className="flex items-center gap-2 p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-sm">
                    <span className="font-medium text-orange-800 dark:text-orange-300 flex-1">Mevcut ID: <span className="font-mono">#{value}</span></span>
                    <button type="button" onClick={handleClear} className="text-orange-500 hover:text-red-600">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ) : null}

            {!isManual ? (
                <div className="relative">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                        <Input
                            className="pl-8 border-orange-200 focus-visible:ring-orange-500"
                            placeholder="HB kategorisi ara (min. 2 karakter)..."
                            value={search}
                            onChange={(e) => handleSearch(e.target.value)}
                        />
                        {loading && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-orange-500" />}
                    </div>

                    <button 
                        type="button" 
                        onClick={() => setIsManual(true)}
                        className="text-[10px] text-orange-600 hover:underline mt-1 block"
                    >
                        Listede yok mu? Manuel ID girmek için tıklayın.
                    </button>

                    {error && (
                        <p className="text-xs text-red-500 mt-1">{error}</p>
                    )}

                    {open && results.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-orange-200 rounded-lg shadow-xl">
                            {results.map((cat) => (
                                <button
                                    key={cat.categoryId}
                                    type="button"
                                    onClick={() => handleSelect(cat)}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 dark:hover:bg-orange-900/20 flex items-start justify-between gap-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
                                >
                                    <div className="flex flex-col gap-1">
                                        <span className="whitespace-normal leading-relaxed text-xs font-medium">{cat.name}</span>
                                        {cat.paths && (
                                            <span className="text-[10px] text-gray-400 line-clamp-1 italic">
                                                {cat.paths.join(" > ")}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xs text-gray-400 font-mono shrink-0 pt-0.5">#{cat.categoryId}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-2 p-2 border border-dashed border-orange-300 rounded-lg">
                    <Label className="text-[10px] text-orange-600">Manuel Hepsiburada Kategori ID</Label>
                    <div className="flex gap-2">
                        <Input 
                            className="h-8 text-sm"
                            placeholder="Örn: 80405008"
                            value={manualId}
                            onChange={(e) => setManualId(e.target.value)}
                        />
                        <Button size="sm" className="bg-orange-600 hover:bg-orange-700" onClick={handleManualSubmit}>Ekle</Button>
                        <Button size="sm" variant="ghost" onClick={() => setIsManual(false)}>İptal</Button>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Idefix Category Search Component ---
interface IdefixCategory {
    id: number;
    name: string;
}

function IdefixCategorySearch({
    value,
    onChange,
}: {
    value?: number;
    onChange: (id: number | undefined) => void;
}) {
    const [search, setSearch] = useState("");
    const [allCategories, setAllCategories] = useState<IdefixCategory[]>([]);
    const [results, setResults] = useState<IdefixCategory[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [selectedName, setSelectedName] = useState<string>("");
    const [error, setError] = useState<string>("");

    const fetchCategories = async () => {
        if (allCategories.length > 0) return allCategories;
        setLoading(true);
        setError("");
        try {
            const res = await getIdefixCategories();
            if (res.success && res.data) {
                setAllCategories(res.data);
                return res.data;
            } else {
                setError(res.message || "Idefix kategorileri alınamadı.");
                return [];
            }
        } catch {
            setError("Bağlantı hatası.");
            return [];
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (q: string) => {
        setSearch(q);
        if (q.length < 2) { setResults([]); return; }
        const cats = await fetchCategories();
        const filtered = cats.filter(c => c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 100);
        setResults(filtered);
        setOpen(true);
    };

    const handleSelect = (cat: IdefixCategory) => {
        onChange(cat.id);
        setSelectedName(cat.name);
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
                <div className="flex items-center gap-2 p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-sm">
                    <span className="font-medium text-purple-800 dark:text-purple-300 flex-1 truncate">✓ {selectedName}</span>
                    <span className="text-xs text-purple-600 font-mono">#{value}</span>
                    <button type="button" onClick={handleClear} className="text-purple-500 hover:text-red-600">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ) : value ? (
                <div className="flex items-center gap-2 p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-sm">
                    <span className="font-medium text-purple-800 dark:text-purple-300 flex-1">Mevcut ID: <span className="font-mono">#{value}</span></span>
                    <button type="button" onClick={handleClear} className="text-purple-500 hover:text-red-600">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ) : null}

            <div className="relative">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                        className="pl-8 border-purple-200 focus-visible:ring-purple-500"
                        placeholder="Idefix kategorisi ara (örn: Bisiklet)..."
                        value={search}
                        onChange={(e) => handleSearch(e.target.value)}
                    />
                    {loading && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-purple-500" />}
                </div>

                {error && (
                    <p className="text-xs text-red-500 mt-1">{error}</p>
                )}

                {open && results.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-purple-200 rounded-lg shadow-xl">
                        {results.map((cat) => (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => handleSelect(cat)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 dark:hover:bg-purple-900/20 flex items-start justify-between gap-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
                            >
                                <span className="whitespace-normal leading-relaxed text-xs">{cat.name}</span>
                                <span className="text-xs text-gray-400 font-mono shrink-0 pt-0.5">#{cat.id}</span>
                            </button>
                        ))}
                    </div>
                )}

                {open && results.length === 0 && search.length >= 2 && !loading && (
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-purple-200 rounded-lg shadow-xl p-3 text-sm text-gray-500 text-center">
                        Idefix'te eşleşen kategori bulunamadı.
                    </div>
                )}
            </div>
        </div>
    );
}

interface PazaramaCat {
    id: string;
    name: string;
}

function PazaramaCategorySearch({
    value,
    onChange,
}: {
    value?: string | number;
    onChange: (id: string | undefined) => void;
}) {
    const [search, setSearch] = useState(String(value || ""));
    const [allCategories, setAllCategories] = useState<PazaramaCat[]>([]);
    const [results, setResults] = useState<PazaramaCat[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);

    const flattenPazaramaCategories = (cats: any[], prefix = ""): PazaramaCat[] => {
        let result: PazaramaCat[] = [];
        if (!Array.isArray(cats)) return result;
        for (const c of cats) {
            if (!c || typeof c !== "object") continue;
            const catId = String(c.id || c.categoryId || c.code || c.key || "");
            const rawName = String(c.name || c.categoryName || c.title || c.displayName || "");
            const fullName = prefix ? `${prefix} > ${rawName}` : rawName;
            if (catId && rawName) {
                result.push({ id: catId, name: fullName });
            }
            const children = c.subCategories || c.subCategoriesList || c.children || c.items;
            if (children && Array.isArray(children)) {
                result = result.concat(flattenPazaramaCategories(children, fullName));
            }
        }
        return result;
    };

    const fetchCategories = async () => {
        if (allCategories.length > 0) return allCategories;
        setLoading(true);
        try {
            const { getPazaramaCategories } = await import("@/app/admin/(protected)/integrations/pazarama/actions");
            const res = await getPazaramaCategories();
            if (res.success && res.data && res.data.length > 0) {
                const flattened = flattenPazaramaCategories(res.data);
                setAllCategories(flattened);
                return flattened;
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
        if (q.length < 2) {
            setResults([]);
            setOpen(false);
            return;
        }

        const cats = await fetchCategories();
        const query = q.toLowerCase();
        const filtered = cats
            .filter((c) => c.name.toLowerCase().includes(query) || c.id.toLowerCase().includes(query))
            .slice(0, 50);

        setResults(filtered);
        setOpen(filtered.length > 0);
    };

    const handleSelect = (cat: PazaramaCat) => {
        onChange(cat.id);
        setSearch(cat.id);
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
                    placeholder="Pazarama Kategori ID giriniz veya adı ile arayınız..."
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
                    {results.map((cat) => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => handleSelect(cat)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-pink-50 dark:hover:bg-pink-900/20 flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
                        >
                            <span className="font-medium text-gray-800 dark:text-gray-200">{cat.name}</span>
                            <span className="text-[10px] text-pink-600 font-mono shrink-0">#{cat.id}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

interface CiceksepetiCat {
    id: string;
    name: string;
}

function CiceksepetiCategorySearch({
    value,
    onChange,
}: {
    value?: string | number;
    onChange: (id: string | undefined) => void;
}) {
    const [search, setSearch] = useState(String(value || ""));
    const [allCategories, setAllCategories] = useState<CiceksepetiCat[]>([]);
    const [results, setResults] = useState<CiceksepetiCat[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        setSearch(String(value || ""));
    }, [value]);

    const flattenCiceksepetiCategories = (cats: any[], prefix = ""): CiceksepetiCat[] => {
        let result: CiceksepetiCat[] = [];
        if (!Array.isArray(cats)) return result;
        for (const c of cats) {
            if (!c || typeof c !== "object") continue;
            const catId = String(c.id || c.categoryId || "");
            const rawName = String(c.name || c.categoryName || "");
            const fullName = prefix ? `${prefix} > ${rawName}` : rawName;
            if (catId && rawName) {
                result.push({ id: catId, name: fullName });
            }
            const children = c.subCategories || c.categories || c.items;
            if (children && Array.isArray(children)) {
                result = result.concat(flattenCiceksepetiCategories(children, fullName));
            }
        }
        return result;
    };

    const fetchCategories = async () => {
        if (allCategories.length > 0) return allCategories;
        setLoading(true);
        try {
            const { getCiceksepetiCategories } = await import("@/app/admin/(protected)/integrations/ciceksepeti/actions");
            const cats = await getCiceksepetiCategories();
            if (Array.isArray(cats) && cats.length > 0) {
                const flattened = flattenCiceksepetiCategories(cats);
                setAllCategories(flattened);
                return flattened;
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
        if (q.length < 2) {
            setResults([]);
            setOpen(false);
            return;
        }

        const cats = await fetchCategories();
        const query = q.toLowerCase();
        const filtered = cats
            .filter((c) => c.name.toLowerCase().includes(query) || c.id.toLowerCase().includes(query))
            .slice(0, 50);

        setResults(filtered);
        setOpen(filtered.length > 0);
    };

    const handleSelect = (cat: CiceksepetiCat) => {
        onChange(cat.id);
        setSearch(cat.id);
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
                    className="pl-8 pr-8 border-rose-200 focus-visible:ring-rose-500 text-xs font-mono"
                    placeholder="Çiçeksepeti Kategori ID giriniz veya adı ile arayınız (örn: Bisiklet)..."
                    value={search}
                    onChange={(e) => handleSearch(e.target.value)}
                />
                {loading && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-rose-500" />}
                {search && !loading && (
                    <button type="button" onClick={handleClear} className="absolute right-2.5 top-2.5 text-gray-400 hover:text-red-500">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {open && results.length > 0 && (
                <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-rose-200 rounded-lg shadow-xl">
                    {results.map((cat) => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => handleSelect(cat)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
                        >
                            <span className="font-medium text-gray-800 dark:text-gray-200">{cat.name}</span>
                            <span className="text-[10px] text-rose-600 font-mono shrink-0">#{cat.id}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

interface PttavmCat {
    id: number;
    name: string;
}

function PttavmCategorySearch({
    value,
    onChange,
}: {
    value?: number;
    onChange: (id: number | undefined) => void;
}) {
    const [search, setSearch] = useState(value ? String(value) : "");
    const [allCategories, setAllCategories] = useState<PttavmCat[]>([]);
    const [results, setResults] = useState<PttavmCat[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        setSearch(value ? String(value) : "");
    }, [value]);

    const fetchCategories = async () => {
        if (allCategories.length > 0) return allCategories;
        setLoading(true);
        try {
            const { getPttavmCategories } = await import("@/app/admin/(protected)/integrations/pttavm/actions");
            const res = await getPttavmCategories();
            if (res.success && Array.isArray(res.data) && res.data.length > 0) {
                setAllCategories(res.data);
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
        const num = parseInt(q, 10);
        onChange(!isNaN(num) ? num : undefined);
        if (q.length < 2) {
            setResults([]);
            setOpen(false);
            return;
        }

        const cats = await fetchCategories();
        const query = q.toLowerCase();
        const filtered = cats
            .filter((c) => c.name.toLowerCase().includes(query) || String(c.id).includes(query))
            .slice(0, 50);

        setResults(filtered);
        setOpen(filtered.length > 0);
    };

    const handleSelect = (cat: PttavmCat) => {
        onChange(cat.id);
        setSearch(String(cat.id));
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
                    className="pl-8 pr-8 border-teal-200 focus-visible:ring-teal-500 text-xs font-mono"
                    placeholder="ePttAVM Kategori ID giriniz veya adı ile arayınız..."
                    value={search}
                    onChange={(e) => handleSearch(e.target.value)}
                />
                {loading && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-teal-500" />}
                {search && !loading && (
                    <button type="button" onClick={handleClear} className="absolute right-2.5 top-2.5 text-gray-400 hover:text-red-500">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {open && results.length > 0 && (
                <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-teal-200 rounded-lg shadow-xl">
                    {results.map((cat) => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => handleSelect(cat)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-teal-50 dark:hover:bg-teal-900/20 flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
                        >
                            <span className="font-medium text-gray-800 dark:text-gray-200">{cat.name}</span>
                            <span className="text-[10px] text-teal-600 font-mono shrink-0">#{cat.id}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export function CategoriesTable({ categories }: CategoriesTableProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [parentSearch, setParentSearch] = useState("");
    const [parentSelectOpen, setParentSelectOpen] = useState(false);
    const [editCategory, setEditCategory] = useState<Category | null>(null);
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [store, setStore] = useState<"BIKE" | "MOTOR" | "BOTH">("BIKE");
    const [order, setOrder] = useState(0);
    const [isInHeader, setIsInHeader] = useState(false);
    const [headerOrder, setHeaderOrder] = useState(0);
    const [parentId, setParentId] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState("");
    const [menuImageUrl, setMenuImageUrl] = useState("");
    const [isFeatured, setIsFeatured] = useState(false);
    const [trendyolCategoryId, setTrendyolCategoryId] = useState<number | undefined>(undefined);
    const [n11CategoryId, setN11CategoryId] = useState<number | undefined>(undefined);
    const [pttavmCategoryId, setPttavmCategoryId] = useState<number | undefined>(undefined);
    const [hbCategoryId, setHbCategoryId] = useState<string | undefined>(undefined);
    const [idefixCategoryId, setIdefixCategoryId] = useState<number | undefined>(undefined);
    const [pazaramaCategoryId, setPazaramaCategoryId] = useState<string | undefined>(undefined);
    const [ciceksepetiCategoryId, setCiceksepetiCategoryId] = useState<string | undefined>(undefined);
    const [googleProductCategory, setGoogleProductCategory] = useState<string | undefined>(undefined);
    const [description, setDescription] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [filterMissingMapping, setFilterMissingMapping] = useState<"all" | "trendyol" | "n11" | "hb" | "any">("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [reorderMode, setReorderMode] = useState<"none" | "sidebar" | "header">("none");
    const [localCategories, setLocalCategories] = useState<Category[]>(categories);
    // Category Products Inspection & Movement state
    const [inspectCategory, setInspectCategory] = useState<Category | null>(null);
    const [inspectProducts, setInspectProducts] = useState<any[]>([]);
    const [loadingInspectProducts, setLoadingInspectProducts] = useState(false);
    const [targetCategoryId, setTargetCategoryId] = useState<string>("");
    const [movingProductId, setMovingProductId] = useState<string | null>(null);
    const [bulkMoving, setBulkMoving] = useState(false);

    const handleOpenInspectProducts = async (category: Category) => {
        setInspectCategory(category);
        setInspectProducts([]);
        setLoadingInspectProducts(true);
        setTargetCategoryId("");
        try {
            const res = await getCategoryProductsAction(category.id);
            if (res.success && res.products) {
                setInspectProducts(res.products);
            } else {
                toast.error("Ürünler yüklenemedi: " + (res.error || "Bilinmeyen hata"));
            }
        } catch {
            toast.error("Ürünler yüklenirken bir hata oluştu.");
        } finally {
            setLoadingInspectProducts(false);
        }
    };

    const handleMoveSingleProduct = async (productId: string, destinationCatId: string) => {
        if (!destinationCatId) {
            toast.error("Lütfen hedef bir kategori seçiniz.");
            return;
        }
        setMovingProductId(productId);
        try {
            const res = await moveProductToCategoryAction(productId, destinationCatId);
            if (res.success) {
                toast.success("Ürün başarıyla taşındı.");
                setInspectProducts(prev => prev.filter(p => p.id !== productId));
                setLocalCategories(prev => prev.map(c => {
                    if (c.id === inspectCategory?.id) {
                        return { ...c, _count: { products: Math.max(0, c._count.products - 1) } };
                    }
                    if (c.id === destinationCatId) {
                        return { ...c, _count: { products: c._count.products + 1 } };
                    }
                    return c;
                }));
                if (inspectCategory) {
                    setInspectCategory(prev => prev ? {
                        ...prev,
                        _count: { products: Math.max(0, prev._count.products - 1) }
                    } : null);
                }
            } else {
                toast.error(res.error || "Taşıma başarısız.");
            }
        } catch {
            toast.error("Taşıma sırasında hata oluştu.");
        } finally {
            setMovingProductId(null);
        }
    };

    const handleBulkMoveProducts = async (deleteSourceAfterMove: boolean = false) => {
        if (!inspectCategory) return;
        if (!targetCategoryId) {
            toast.error("Lütfen aktarmak istediğiniz hedef kategoriyi seçiniz.");
            return;
        }

        const targetCatName = localCategories.find(c => c.id === targetCategoryId)?.name || "seçilen kategoriye";
        const confirmMsg = deleteSourceAfterMove
            ? `"${inspectCategory.name}" kategorisindeki TÜM ürünler "${targetCatName}" kategorisine taşınacak ve "${inspectCategory.name}" kategorisi SİLİNECEKTİR. Onaylıyor musunuz?`
            : `"${inspectCategory.name}" kategorisindeki TÜM ürünler "${targetCatName}" kategorisine taşınacaktır. Onaylıyor musunuz?`;

        if (!confirm(confirmMsg)) return;

        setBulkMoving(true);
        try {
            const res = await moveAllProductsAndMergeCategoryAction(inspectCategory.id, targetCategoryId, deleteSourceAfterMove);
            if (res.success) {
                toast.success(res.message);
                setInspectCategory(null);
                window.location.reload();
            } else {
                toast.error(res.error || "Toplu taşıma başarısız.");
            }
        } catch {
            toast.error("Toplu taşıma sırasında bir hata oluştu.");
        } finally {
            setBulkMoving(false);
        }
    };

    // Sync local state when server data updates
    useEffect(() => {
        setLocalCategories(categories);
    }, [categories]);

    const ITEMS_PER_PAGE = reorderMode === "none" ? 50 : 1000; // Increased to 50

    // Filter categories based on search and mapping status
    const filteredCategories = localCategories.filter(category => {
        if (reorderMode === "header" && !category.isInHeader && !searchTerm) return false;

        const matchesSearch = category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (category.parent?.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            category.slug.toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchesSearch) return false;

        if (filterMissingMapping === "trendyol") return !category.trendyolCategoryId;
        if (filterMissingMapping === "n11") return !category.n11CategoryId;
        if (filterMissingMapping === "hb") return !category.hbCategoryId;
        if (filterMissingMapping === "any") return !category.trendyolCategoryId || !category.n11CategoryId || !category.hbCategoryId;

        return true;
    });

    // Sort based on mode
    const sortedCategories = [...filteredCategories].sort((a, b) => {
        if (reorderMode === "header") return a.headerOrder - b.headerOrder;
        return a.order - b.order;
    });

    // Pagination logic
    const totalPages = Math.ceil(sortedCategories.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedCategories = sortedCategories.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = sortedCategories.findIndex((c) => c.id === active.id);
            const newIndex = sortedCategories.findIndex((c) => c.id === over.id);

            const newArray = arrayMove(sortedCategories, oldIndex, newIndex);

            // Update local state first for immediate UI response
            const updatedLocal = localCategories.map(cat => {
                const index = newArray.findIndex(n => n.id === cat.id);
                if (index !== -1) {
                    return {
                        ...cat,
                        [reorderMode === "sidebar" ? "order" : "headerOrder"]: index
                    };
                }
                return cat;
            });
            setLocalCategories(updatedLocal);

            try {
                if (reorderMode === "sidebar") {
                    const updates = newArray.map((cat, index) => ({
                        id: cat.id,
                        order: index
                    }));
                    await updateCategoriesSidebarOrder(updates);
                } else if (reorderMode === "header") {
                    const updates = newArray.map((cat, index) => ({
                        id: cat.id,
                        headerOrder: index
                    }));
                    await updateCategoriesHeaderOrder(updates);
                }
                toast.success("Sıralama güncellendi.");
            } catch {
                toast.error("Sıralama kaydedilirken bir hata oluştu.");
                setLocalCategories(categories); // Rollback
            }
        }
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1); // Reset to first page on search
    };

    const [uploading, setUploading] = useState(false);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        setUploading(true);
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) throw new Error("Upload failed");

            const data = await res.json();
            setImageUrl(data.url);
            toast.success("Resim yüklendi");
        } catch {
            toast.error("Resim yüklenirken hata oluştu");
        } finally {
            setUploading(false);
        }
    };

    const handleMenuImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        setUploading(true);
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) throw new Error("Upload failed");

            const data = await res.json();
            setMenuImageUrl(data.url);
            toast.success("Mega menü görseli yüklendi");
        } catch {
            toast.error("Resim yüklenirken hata oluştu");
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            let result;
            if (editCategory) {
                result = await updateCategory(editCategory.id, {
                    name,
                    slug,
                    store,
                    order,
                    parentId: parentId || null,
                    imageUrl,
                    menuImageUrl,
                    isFeatured,
                    isInHeader,
                    headerOrder,
                    trendyolCategoryId,
                    n11CategoryId,
                    pttavmCategoryId,
                    hbCategoryId,
                    idefixCategoryId,
                    pazaramaCategoryId,
                    ciceksepetiCategoryId,
                    googleProductCategory,
                    description: description || null
                });
            } else {
                result = await createCategory({
                    name,
                    slug,
                    store,
                    order,
                    parentId: parentId || null,
                    imageUrl,
                    menuImageUrl,
                    isFeatured,
                    isInHeader,
                    headerOrder,
                    trendyolCategoryId,
                    n11CategoryId,
                    pttavmCategoryId,
                    hbCategoryId,
                    idefixCategoryId,
                    pazaramaCategoryId,
                    ciceksepetiCategoryId,
                    googleProductCategory,
                    description: description || undefined
                });
            }

            if (result.success) {
                toast.success(result.message);
                setIsOpen(false);
                resetForm();
            } else {
                toast.error(result.message);
            }
        } catch (error: any) {
            console.error(error);
            toast.error("İşlem sırasında bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Bu kategoriyi silmek istediğinize emin misiniz?")) return;

        try {
            await deleteCategory(id);
            toast.success("Kategori silindi.");
        } catch {
            toast.error("Bir hata oluştu.");
        }
    };

    const handleToggleStatus = async (id: string, isActive: boolean) => {
        try {
            await toggleCategoryStatus(id, isActive);
            toast.success(isActive ? "Kategori aktifleştirildi." : "Kategori pasifleştirildi.");
        } catch {
            toast.error("Bir hata oluştu.");
        }
    };


    const resetForm = () => {
        setName("");
        setSlug("");
        setStore("BIKE");
        setOrder(0);
        setIsInHeader(false);
        setHeaderOrder(0);
        setParentId(null);
        setParentSearch("");
        setImageUrl("");
        setMenuImageUrl("");
        setIsFeatured(false);
        setTrendyolCategoryId(undefined);
        setN11CategoryId(undefined);
        setPttavmCategoryId(undefined);
        setHbCategoryId(undefined);
        setIdefixCategoryId(undefined);
        setPazaramaCategoryId(undefined);
        setCiceksepetiCategoryId(undefined);
        setGoogleProductCategory(undefined);
        setDescription("");
        setEditCategory(null);
    };

    const openEditDialog = (category: Category) => {
        setEditCategory(category);
        setName(category.name);
        setSlug(category.slug);
        setStore(category.store || "BIKE");
        setOrder(category.order);
        setIsInHeader(category.isInHeader);
        setHeaderOrder(category.headerOrder);
        setParentId(category.parentId || null);
        setImageUrl(category.imageUrl || "");
        setMenuImageUrl(category.menuImageUrl || "");
        setIsFeatured(category.isFeatured);
        setTrendyolCategoryId(category.trendyolCategoryId ?? undefined);
        setN11CategoryId(category.n11CategoryId ?? undefined);
        setPttavmCategoryId(category.pttavmCategoryId ?? undefined);
        setHbCategoryId(category.hbCategoryId ?? undefined);
        setIdefixCategoryId(category.idefixCategoryId ? Number(category.idefixCategoryId) : undefined);
        setPazaramaCategoryId(category.pazaramaCategoryId ? String(category.pazaramaCategoryId) : undefined);
        setCiceksepetiCategoryId(category.ciceksepetiCategoryId ? String(category.ciceksepetiCategoryId) : undefined);
        setGoogleProductCategory(category.googleProductCategory ?? undefined);
        setDescription(category.description || "");
        setIsOpen(true);
    };

    const openNewDialog = () => {
        resetForm();
        setIsOpen(true);
    };

    return (
        <>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-72">
                        <Input
                            placeholder="Kategori Ara..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                            className="pl-8"
                        />
                    </div>
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                        <Button
                            variant={reorderMode === "none" ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setReorderMode("none")}
                        >
                            Liste
                        </Button>
                        <Button
                            variant={reorderMode === "sidebar" ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setReorderMode("sidebar")}
                        >
                            Yan Menü
                        </Button>
                        <Button
                            variant={reorderMode === "header" ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setReorderMode("header")}
                        >
                            Üst Menü
                        </Button>
                    </div>

                    <Select value={filterMissingMapping} onValueChange={(val: any) => { setFilterMissingMapping(val); setCurrentPage(1); }}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Eşleştirme Filtresi" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tüm Kategoriler</SelectItem>
                            <SelectItem value="any">Eksik Eşleştirmeler</SelectItem>
                            <SelectItem value="trendyol">Trendyol Eksik</SelectItem>
                            <SelectItem value="n11">N11 Eksik</SelectItem>
                            <SelectItem value="hb">Hepsiburada Eksik</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-2">
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={openNewDialog}>
                                <Plus className="h-4 w-4 mr-2" />
                                Yeni Kategori
                            </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>
                                {editCategory ? "Kategori Düzenle" : "Yeni Kategori"}
                            </DialogTitle>
                            <DialogDescription>
                                Kategori bilgilerini girin
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit}>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Kategori Adı</Label>
                                    <Input
                                        id="name"
                                        value={name}
                                        onChange={(e) => {
                                            setName(e.target.value);
                                            if (!editCategory) {
                                                setSlug(slugify(e.target.value));
                                            }
                                        }}
                                        placeholder="Örn: Temizlik Ürünleri"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="slug">URL Slug</Label>
                                    <Input
                                        id="slug"
                                        value={slug}
                                        onChange={(e) => setSlug(e.target.value)}
                                        placeholder="temizlik-urunleri"
                                        required
                                    />
                                </div>
                                <div className="space-y-2 p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                    <Label htmlFor="categoryStore" className="text-emerald-800 dark:text-emerald-300 font-bold text-xs uppercase tracking-wide">🏪 Mağaza Yayın Alanı</Label>
                                    <select
                                        id="categoryStore"
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
                                    <Label htmlFor="trendyolCategoryId" className="text-orange-700 dark:text-orange-400 font-semibold text-xs uppercase tracking-wide">🟠 Trendyol Kategori Eşleştirme</Label>
                                    <TrendyolCategorySearch
                                        value={trendyolCategoryId}
                                        onChange={setTrendyolCategoryId}
                                    />
                                </div>
                                <div className="space-y-2 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                                    <Label htmlFor="n11CategoryId" className="text-purple-700 dark:text-purple-400 font-semibold text-xs uppercase tracking-wide">🟣 N11 Kategori Eşleştirme</Label>
                                    <N11CategorySearch
                                        value={n11CategoryId}
                                        onChange={setN11CategoryId}
                                    />
                                    <p className="text-[10px] text-purple-600">N11 kategorisini adıyla arayıp seçebilirsiniz.</p>
                                </div>
                                <div className="space-y-2 p-3 bg-teal-50 dark:bg-teal-950/20 rounded-lg border border-teal-200 dark:border-teal-800">
                                    <Label htmlFor="pttavmCategoryId" className="text-teal-700 dark:text-teal-400 font-semibold text-xs uppercase tracking-wide">📮 ePttAVM Kategori Eşleştirme</Label>
                                    <PttavmCategorySearch
                                        value={pttavmCategoryId}
                                        onChange={setPttavmCategoryId}
                                    />
                                    <p className="text-[10px] text-teal-600">ePttAVM kategorisini adıyla arayıp (örn: Bisiklet) seçebilirsiniz.</p>
                                </div>
                                <div className="space-y-2 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                                    <Label htmlFor="hbCategoryId" className="text-orange-700 dark:text-orange-400 font-semibold text-xs uppercase tracking-wide">🟠 Hepsiburada Kategori Eşleştirme</Label>
                                    <HepsiburadaCategorySearch
                                        value={hbCategoryId}
                                        onChange={setHbCategoryId}
                                    />
                                    <p className="text-[10px] text-orange-600">HB kategorisini adıyla arayıp seçebilirsiniz.</p>
                                </div>
                                <div className="space-y-2 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                                    <Label htmlFor="idefixCategoryId" className="text-purple-700 dark:text-purple-400 font-semibold text-xs uppercase tracking-wide">🟣 Idefix Kategori Eşleştirme</Label>
                                    <IdefixCategorySearch
                                        value={idefixCategoryId}
                                        onChange={setIdefixCategoryId}
                                    />
                                    <p className="text-[10px] text-purple-600">Idefix kategorisini adıyla arayıp (örn: Bisiklet) seçebilirsiniz.</p>
                                </div>
                                <div className="space-y-2 p-3 bg-pink-50 dark:bg-pink-950/20 rounded-lg border border-pink-200 dark:border-pink-800">
                                    <Label htmlFor="pazaramaCategoryId" className="text-pink-700 dark:text-pink-400 font-semibold text-xs uppercase tracking-wide">🌸 Pazarama Kategori Eşleştirme</Label>
                                    <PazaramaCategorySearch
                                        value={pazaramaCategoryId}
                                        onChange={setPazaramaCategoryId}
                                    />
                                    <p className="text-[10px] text-pink-600">Pazarama kategorisini adıyla arayıp (örn: Bisiklet Pedal) seçebilirsiniz.</p>
                                </div>
                                <div className="space-y-2 p-3 bg-rose-50 dark:bg-rose-950/20 rounded-lg border border-rose-200 dark:border-rose-800">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="ciceksepetiCategoryId" className="text-rose-700 font-semibold text-xs uppercase tracking-wide">🌸 Çiçeksepeti Kategori Eşleştirme</Label>
                                        {editCategory && ciceksepetiCategoryId && (
                                            <CiceksepetiAttributeMappingModal
                                                categoryId={editCategory.id}
                                                categoryName={name}
                                                ciceksepetiCategoryId={ciceksepetiCategoryId}
                                            />
                                        )}
                                    </div>
                                    <CiceksepetiCategorySearch
                                        value={ciceksepetiCategoryId}
                                        onChange={setCiceksepetiCategoryId}
                                    />
                                    <p className="text-[10px] text-rose-600">Çiçeksepeti kategorisini adıyla arayıp (örn: Bisiklet) seçebilirsiniz.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="googleProductCategory" className="text-[#17457C]">Google Ürün Kategorisi (Taxonomy)</Label>
                                    <Input
                                        id="googleProductCategory"
                                        value={googleProductCategory || ""}
                                        onChange={(e) => setGoogleProductCategory(e.target.value)}
                                        placeholder="Örn: Araçlar ve Motorlu Taşıtlar > Araç Parçaları ve Aksesuarları"
                                        className="border-blue-200"
                                    />
                                    <p className="text-[10px] text-gray-500">
                                        Google Merchant Center için geçerli taksonomi yolunu tam olarak girin.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="order">Sıralama</Label>
                                    <Input
                                        id="order"
                                        type="number"
                                        value={order}
                                        onChange={(e) => setOrder(parseInt(e.target.value) || 0)}
                                    />
                                </div>
                                 <div className="space-y-2">
                                     <Label>Üst Kategori</Label>
                                     <Popover open={parentSelectOpen} onOpenChange={setParentSelectOpen}>
                                         <PopoverTrigger asChild>
                                             <Button
                                                 variant="outline"
                                                 role="combobox"
                                                 aria-expanded={parentSelectOpen}
                                                 className="w-full justify-between font-normal bg-white dark:bg-gray-950 h-10 px-3"
                                             >
                                                 <span className="truncate">
                                                     {parentId
                                                         ? categories.find((c) => c.id === parentId)?.name
                                                         : "Ana Kategori"}
                                                 </span>
                                                 <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                             </Button>
                                         </PopoverTrigger>
                                         <PopoverContent align="start" className="p-0 w-80 overflow-hidden shadow-xl bg-white dark:bg-gray-950 border">
                                             <div className="flex flex-col h-full max-h-[inherit]">
                                                 <div className="p-3 border-b shrink-0 bg-white dark:bg-gray-950 sticky top-0 z-10 flex items-center gap-2">
                                                     <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                                                     <Input
                                                         placeholder="Üst kategori ara..."
                                                         value={parentSearch}
                                                         onChange={(e) => setParentSearch(e.target.value)}
                                                         className="h-9 text-sm"
                                                         autoFocus
                                                     />
                                                 </div>
                                                 <div className="flex-1 overflow-y-auto min-h-[150px] max-h-[300px]">
                                                     <div className="p-1">
                                                         <button
                                                             type="button"
                                                             onClick={() => {
                                                                 setParentId(null);
                                                                 setParentSelectOpen(false);
                                                                 setParentSearch("");
                                                             }}
                                                             className={cn(
                                                                 "w-full flex items-center justify-between px-3 py-2 text-sm text-left rounded-md transition-colors hover:bg-accent",
                                                                 !parentId && "bg-accent font-medium text-accent-foreground"
                                                             )}
                                                         >
                                                             <span className="truncate">Ana Kategori</span>
                                                             {!parentId && <Check className="h-4 w-4 text-[#17457C] shrink-0" />}
                                                         </button>
                                                         
                                                         {categories
                                                             .filter(c => c.id !== editCategory?.id)
                                                             .filter((c) =>
                                                                 c.name.toLocaleLowerCase("tr-TR").includes(parentSearch.toLocaleLowerCase("tr-TR"))
                                                             )
                                                             .map((c) => (
                                                                 <button
                                                                     key={c.id}
                                                                     type="button"
                                                                     onClick={() => {
                                                                         setParentId(c.id);
                                                                         setParentSelectOpen(false);
                                                                         setParentSearch("");
                                                                     }}
                                                                     className={cn(
                                                                         "w-full flex items-center justify-between px-3 py-2 text-sm text-left rounded-md transition-colors hover:bg-accent",
                                                                         parentId === c.id && "bg-accent font-medium text-accent-foreground"
                                                                     )}
                                                                 >
                                                                     <span className="truncate">{c.name}</span>
                                                                     {parentId === c.id && (
                                                                         <Check className="h-4 w-4 text-[#17457C] shrink-0" />
                                                                     )}
                                                                 </button>
                                                             ))}
                                                     </div>
                                                 </div>
                                             </div>
                                         </PopoverContent>
                                     </Popover>
                                 </div>
                                <div className="space-y-2">
                                    <Label>Kategori Görseli</Label>
                                    <div className="flex items-center gap-4">
                                        {imageUrl && (
                                            <div className="relative w-16 h-16 border rounded-md overflow-hidden">
                                                <img src={imageUrl} alt="Kategori" className="object-cover w-full h-full" />
                                                <button
                                                    type="button"
                                                    onClick={() => setImageUrl("")}
                                                    className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            disabled={uploading}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Mega Menü Görseli</Label>
                                    <div className="flex items-center gap-4">
                                        {menuImageUrl && (
                                            <div className="relative w-16 h-16 border rounded-md overflow-hidden">
                                                <img src={menuImageUrl} alt="Mega Menü" className="object-cover w-full h-full" />
                                                <button
                                                    type="button"
                                                    onClick={() => setMenuImageUrl("")}
                                                    className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleMenuImageUpload}
                                            disabled={uploading}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Kategori SEO Açıklaması (HTML)</Label>
                                    <RichTextEditor
                                        content={description}
                                        onChange={setDescription}
                                        placeholder="Kategori hakkında arama motoru dostu SEO metni yazın..."
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            id="featured"
                                            checked={isFeatured}
                                            onCheckedChange={setIsFeatured}
                                        />
                                        <Label htmlFor="featured">Ana Sayfada Göster</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            id="inHeader"
                                            checked={isInHeader}
                                            onCheckedChange={setIsInHeader}
                                        />
                                        <Label htmlFor="inHeader">Üst Menüde Göster</Label>
                                    </div>
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
        </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <div className="rounded-lg border bg-white dark:bg-gray-800">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Sıra</TableHead>
                                <TableHead>Kategori Adı</TableHead>
                                <TableHead>Slug</TableHead>
                                <TableHead>Ürün Sayısı</TableHead>
                                <TableHead>Entegrasyon</TableHead>
                                <TableHead>Durum</TableHead>
                                <TableHead className="text-right">İşlemler</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedCategories.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                        {searchTerm ? "Sonuç bulunamadı." : "Henüz kategori bulunmuyor."}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                <SortableContext
                                    items={paginatedCategories.map((c) => c.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    {paginatedCategories.map((category) => (
                                        <SortableRow
                                            key={category.id}
                                            category={category}
                                            onEdit={openEditDialog}
                                            onDelete={handleDelete}
                                            onToggleStatus={handleToggleStatus}
                                            onInspectProducts={handleOpenInspectProducts}
                                            reorderMode={reorderMode}
                                        />
                                    ))}
                                </SortableContext>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </DndContext>

            {/* Category Products Inspection & Migration Modal */}
            <Dialog open={!!inspectCategory} onOpenChange={(open) => !open && setInspectCategory(null)}>
                <DialogContent className="sm:max-w-[850px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg">
                            <span>📂</span>
                            <span>"{inspectCategory?.name}" Kategorisine Bağlı Ürünler</span>
                            <Badge variant="secondary" className="ml-auto font-mono text-xs">
                                {inspectCategory?._count.products || inspectProducts.length} Ürün
                            </Badge>
                        </DialogTitle>
                        <DialogDescription>
                            Bu kategorideki ürünleri inceleyebilir, ürün bazında veya toplu olarak başka bir kategoriye taşıyabilirsiniz.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Bulk Actions Panel */}
                    {inspectCategory && inspectCategory._count.products > 0 && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg space-y-3">
                            <div className="text-sm font-semibold text-amber-900 dark:text-amber-300 flex items-center gap-2">
                                <FolderSync className="w-4 h-4 text-amber-600" />
                                <span>Kategori Birleştirme & Toplu Ürün Taşıma</span>
                            </div>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <Select value={targetCategoryId} onValueChange={setTargetCategoryId}>
                                    <SelectTrigger className="flex-1 bg-white dark:bg-gray-800">
                                        <SelectValue placeholder="Aktarılacak Hedef Kategoriyi Seçiniz..." />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-60 overflow-y-auto">
                                        {localCategories
                                            .filter(c => c.id !== inspectCategory.id)
                                            .map(c => (
                                                <SelectItem key={c.id} value={c.id}>
                                                    {c.name} {c.parent ? `(${c.parent.name})` : ""}
                                                </SelectItem>
                                            ))
                                        }
                                    </SelectContent>
                                </Select>

                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => handleBulkMoveProducts(false)}
                                        disabled={bulkMoving || !targetCategoryId}
                                        className="bg-amber-200 hover:bg-amber-300 text-amber-900 font-medium"
                                    >
                                        {bulkMoving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <ArrowRight className="w-3.5 h-3.5 mr-1" />}
                                        Tüm Ürünleri Taşı
                                    </Button>

                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => handleBulkMoveProducts(true)}
                                        disabled={bulkMoving || !targetCategoryId}
                                    >
                                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                                        Taşı ve Kategoriyi Sil
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Products List */}
                    <div className="space-y-3 my-2">
                        {loadingInspectProducts ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                                <span className="text-sm">Kategoriye bağlı ürünler yükleniyor...</span>
                            </div>
                        ) : inspectProducts.length === 0 ? (
                            <div className="text-center py-8 text-gray-500 border border-dashed rounded-lg">
                                Bu kategoride bağlı ürün bulunmuyor.
                            </div>
                        ) : (
                            <div className="divide-y border rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                                {inspectProducts.map((product) => {
                                    const firstImg = product.images?.[0];
                                    return (
                                        <div key={product.id} className="p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className="w-12 h-12 rounded border bg-gray-100 dark:bg-gray-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                                    {firstImg ? (
                                                        <img src={firstImg} alt={product.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-xs text-gray-400">Görsel Yok</span>
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <a
                                                        href={`/admin/products?search=${encodeURIComponent(product.sku || product.name)}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="font-medium text-sm text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1.5 group"
                                                    >
                                                        <span className="truncate">{product.name}</span>
                                                        <ExternalLink className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-600 shrink-0" />
                                                    </a>
                                                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-0.5 font-mono">
                                                        <span>SKU: {product.sku || "-"}</span>
                                                        <span>•</span>
                                                        <span>Stok: {product.stock} adet</span>
                                                        <span>•</span>
                                                        <span className="text-emerald-600 font-bold">{product.listPrice} ₺</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Single Product Category Transfer Form */}
                                            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                                                <Select
                                                    onValueChange={(val) => handleMoveSingleProduct(product.id, val)}
                                                    disabled={movingProductId === product.id}
                                                >
                                                    <SelectTrigger className="w-[190px] h-8 text-xs bg-gray-50 dark:bg-gray-900">
                                                        <SelectValue placeholder="Başka Kategoriye Taşı..." />
                                                    </SelectTrigger>
                                                    <SelectContent className="max-h-60 overflow-y-auto">
                                                        {localCategories
                                                            .filter(c => c.id !== inspectCategory?.id)
                                                            .map(c => (
                                                                <SelectItem key={c.id} value={c.id} className="text-xs">
                                                                    {c.name}
                                                                </SelectItem>
                                                            ))
                                                        }
                                                    </SelectContent>
                                                </Select>
                                                {movingProductId === product.id && (
                                                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setInspectCategory(null)}>
                            Kapat
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-end space-x-2 py-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                    >
                        Önceki
                    </Button>
                    <div className="text-sm font-medium">
                        Sayfa {currentPage} / {totalPages}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                    >
                        Sonraki
                    </Button>
                </div>
            )}
        </>
    );
}
