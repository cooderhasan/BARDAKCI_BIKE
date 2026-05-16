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
import { X, Plus, Pencil, Trash2, Search, Loader2 } from "lucide-react";
import { getTrendyolCategories } from "@/app/admin/(protected)/integrations/trendyol/actions";
import { getFlatN11Categories } from "@/app/admin/(protected)/integrations/n11/actions";
import { getHepsiburadaCategories } from "@/app/admin/(protected)/integrations/hepsiburada/actions";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { createCategory, updateCategory, deleteCategory, toggleCategoryStatus, updateCategoriesSidebarOrder, updateCategoriesHeaderOrder } from "@/app/admin/(protected)/categories/actions";
import { searchHepsiburadaCategories } from "@/app/admin/(protected)/integrations/hepsiburada/actions";
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
    hbCategoryId?: string | null;
    googleProductCategory?: string | null;
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
    reorderMode: "none" | "sidebar" | "header";
}

function SortableRow({ category, onEdit, onDelete, onToggleStatus, reorderMode }: SortableRowProps) {
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
                    <span className="font-medium">{category.name}</span>
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
                    <Badge variant="secondary">
                        {category._count.products} ürün
                    </Badge>
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
                    <div title={category.hbCategoryId ? "Hepsiburada Bağlı" : "Hepsiburada Bağlı Değil"}>
                        <div className={`w-2 h-2 rounded-full ${category.hbCategoryId ? "bg-orange-600" : "bg-gray-200"}`} />
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

export function CategoriesTable({ categories }: CategoriesTableProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [editCategory, setEditCategory] = useState<Category | null>(null);
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [order, setOrder] = useState(0);
    const [isInHeader, setIsInHeader] = useState(false);
    const [headerOrder, setHeaderOrder] = useState(0);
    const [parentId, setParentId] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState("");
    const [menuImageUrl, setMenuImageUrl] = useState("");
    const [isFeatured, setIsFeatured] = useState(false);
    const [trendyolCategoryId, setTrendyolCategoryId] = useState<number | undefined>(undefined);
    const [n11CategoryId, setN11CategoryId] = useState<number | undefined>(undefined);
    const [hbCategoryId, setHbCategoryId] = useState<string | undefined>(undefined);
    const [googleProductCategory, setGoogleProductCategory] = useState<string | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterMissingMapping, setFilterMissingMapping] = useState<"all" | "trendyol" | "n11" | "hb" | "any">("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [reorderMode, setReorderMode] = useState<"none" | "sidebar" | "header">("none");
    const [localCategories, setLocalCategories] = useState<Category[]>(categories);

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
                    order,
                    parentId: parentId || null,
                    imageUrl,
                    menuImageUrl,
                    isFeatured,
                    isInHeader,
                    headerOrder,
                    trendyolCategoryId,
                    n11CategoryId,
                    hbCategoryId,
                    googleProductCategory
                });
            } else {
                result = await createCategory({
                    name,
                    slug,
                    order,
                    parentId: parentId || null,
                    imageUrl,
                    menuImageUrl,
                    isFeatured,
                    isInHeader,
                    headerOrder,
                    trendyolCategoryId,
                    n11CategoryId,
                    hbCategoryId,
                    googleProductCategory
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
        setOrder(0);
        setIsInHeader(false);
        setHeaderOrder(0);
        setParentId(null);
        setImageUrl("");
        setMenuImageUrl("");
        setIsFeatured(false);
        setTrendyolCategoryId(undefined);
        setN11CategoryId(undefined);
        setHbCategoryId(undefined);
        setGoogleProductCategory(undefined);
        setEditCategory(null);
    };

    const openEditDialog = (category: Category) => {
        setEditCategory(category);
        setName(category.name);
        setSlug(category.slug);
        setOrder(category.order);
        setIsInHeader(category.isInHeader);
        setHeaderOrder(category.headerOrder);
        setParentId(category.parentId || null);
        setImageUrl(category.imageUrl || "");
        setMenuImageUrl(category.menuImageUrl || "");
        setIsFeatured(category.isFeatured);
        setTrendyolCategoryId(category.trendyolCategoryId ?? undefined);
        setN11CategoryId(category.n11CategoryId ?? undefined);
        setHbCategoryId(category.hbCategoryId ?? undefined);
        setGoogleProductCategory(category.googleProductCategory ?? undefined);
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
                                <div className="space-y-2 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                                    <Label htmlFor="hbCategoryId" className="text-orange-700 dark:text-orange-400 font-semibold text-xs uppercase tracking-wide">🟠 Hepsiburada Kategori Eşleştirme</Label>
                                    <HepsiburadaCategorySearch
                                        value={hbCategoryId}
                                        onChange={setHbCategoryId}
                                    />
                                    <p className="text-[10px] text-orange-600">HB kategorisini adıyla arayıp seçebilirsiniz.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="googleProductCategory" className="text-blue-600">Google Ürün Kategorisi (Taxonomy)</Label>
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
                                    <Select
                                        value={parentId || "root"}
                                        onValueChange={(value) => setParentId(value === "root" ? null : value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Üst Kategori Seçin" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="root">Ana Kategori</SelectItem>
                                            {categories
                                                .filter(c => c.id !== editCategory?.id) // Prevent self-parenting
                                                .map((c) => (
                                                    <SelectItem key={c.id} value={c.id}>
                                                        {c.name}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
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
                                            reorderMode={reorderMode}
                                        />
                                    ))}
                                </SortableContext>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </DndContext>

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
