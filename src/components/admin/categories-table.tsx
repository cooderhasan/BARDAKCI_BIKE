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
import { X, Plus, Pencil, Trash2, Search, Loader2, Check, ChevronsUpDown, Eye, ExternalLink, ArrowRight, FolderSync, GripVertical, Sparkles, RefreshCw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { MarketplaceCategoryField } from "@/components/admin/marketplace-category-picker";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { createCategory, updateCategory, deleteCategory, toggleCategoryStatus, updateCategoriesSidebarOrder, updateCategoriesHeaderOrder, fixHeaderOrderAction, getCategoryProductsAction, moveProductToCategoryAction, moveAllProductsAndMergeCategoryAction } from "@/app/admin/(protected)/categories/actions";
import dynamic from "next/dynamic";
const RichTextEditor = dynamic(
    () => import("@/components/admin/rich-text-editor").then((mod) => mod.RichTextEditor),
    { ssr: false }
);
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
            <TableCell className="w-[100px]">
                {reorderMode === "header" ? (
                    <div className="flex items-center gap-1.5">
                        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
                            <GripVertical className="h-4 w-4 text-gray-400" />
                        </div>
                        <Badge variant="outline" className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border-blue-200">
                            #{category.headerOrder}
                        </Badge>
                    </div>
                ) : reorderMode === "sidebar" ? (
                    <div className="flex items-center gap-1.5">
                        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
                            <GripVertical className="h-4 w-4 text-gray-400" />
                        </div>
                        <Badge variant="outline" className="font-mono text-xs font-bold">
                            #{category.order}
                        </Badge>
                    </div>
                ) : (
                    <div className="flex flex-col text-xs text-gray-500 font-mono">
                        <span>Yan: #{category.order}</span>
                        {category.isInHeader && <span className="text-blue-600 font-semibold">Üst: #{category.headerOrder}</span>}
                    </div>
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

/** Pazaryeri kategori ID'si sayı tutan alanlar için: elle yazılan geçersiz değer kaydedilmez */
const toNumId = (id?: string) => (id && /^\d+$/.test(id.trim()) ? Number(id.trim()) : undefined);

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
    const [filterStore, setFilterStore] = useState<"ALL" | "BIKE" | "MOTOR">("ALL");
    const [fixingHeaderOrder, setFixingHeaderOrder] = useState(false);
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

    const handleFixHeaderOrder = async () => {
        if (!confirm("Üst menü sıralaması ideal düzene (Çocuk, Dağ, Şehir, Elektrikli ... Aksesuar ve Yedek Parça en sonda olacak şekilde) otomatik olarak ayarlanıp kaydedilecek. Onaylıyor musunuz?")) return;
        
        setFixingHeaderOrder(true);
        try {
            const res = await fixHeaderOrderAction(filterStore);
            if (res.success) {
                toast.success(res.message);
                window.location.reload();
            } else {
                toast.error(res.message);
            }
        } catch {
            toast.error("Sıralama düzeltilirken bir hata oluştu.");
        } finally {
            setFixingHeaderOrder(false);
        }
    };

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

    // Filter categories based on search, store, and mapping status
    const filteredCategories = localCategories.filter(category => {
        if (reorderMode === "header" && !category.isInHeader && !searchTerm) return false;

        if (filterStore === "BIKE" && category.store !== "BIKE" && category.store !== "BOTH") return false;
        if (filterStore === "MOTOR" && category.store !== "MOTOR" && category.store !== "BOTH") return false;

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
        if (reorderMode === "header") {
            if (a.headerOrder !== b.headerOrder) return a.headerOrder - b.headerOrder;
            return a.order - b.order;
        }
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
                        [reorderMode === "sidebar" ? "order" : "headerOrder"]: reorderMode === "header" ? index + 1 : index
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
                        headerOrder: index + 1
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
                    <div className="relative w-full sm:w-72">
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
                            className={reorderMode === "header" ? "text-blue-700 font-bold" : ""}
                        >
                            Üst Menü
                        </Button>
                    </div>

                    {/* Store Filter Tabs */}
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                        <Button
                            variant={filterStore === "ALL" ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => { setFilterStore("ALL"); setCurrentPage(1); }}
                        >
                            Tümü
                        </Button>
                        <Button
                            variant={filterStore === "BIKE" ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => { setFilterStore("BIKE"); setCurrentPage(1); }}
                            className={filterStore === "BIKE" ? "text-blue-700 font-bold" : ""}
                        >
                            🚲 Bisiklet
                        </Button>
                        <Button
                            variant={filterStore === "MOTOR" ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => { setFilterStore("MOTOR"); setCurrentPage(1); }}
                            className={filterStore === "MOTOR" ? "text-red-700 font-bold" : ""}
                        >
                            🏍️ Motor
                        </Button>
                    </div>

                    {reorderMode === "header" && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleFixHeaderOrder}
                            disabled={fixingHeaderOrder}
                            className="border-blue-300 text-blue-700 bg-blue-50/60 hover:bg-blue-100 font-medium text-xs flex items-center gap-1.5"
                        >
                            {fixingHeaderOrder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-blue-600" />}
                            <span>✨ Otomatik Sırala (Aksesuar & Yedek Parça Sonda)</span>
                        </Button>
                    )}

                    <Select value={filterMissingMapping} onValueChange={(val: any) => { setFilterMissingMapping(val); setCurrentPage(1); }}>
                        <SelectTrigger className="w-full sm:w-[180px]">
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
                                    <MarketplaceCategoryField
                                        marketplace="trendyol"
                                        value={trendyolCategoryId}
                                        onChange={(id) => setTrendyolCategoryId(toNumId(id))}
                                    />
                                </div>
                                <div className="space-y-2 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                                    <Label htmlFor="n11CategoryId" className="text-purple-700 dark:text-purple-400 font-semibold text-xs uppercase tracking-wide">🟣 N11 Kategori Eşleştirme</Label>
                                    <MarketplaceCategoryField
                                        marketplace="n11"
                                        value={n11CategoryId}
                                        onChange={(id) => setN11CategoryId(toNumId(id))}
                                    />
                                    <p className="text-[10px] text-purple-600">N11 kategorisini adıyla arayıp seçebilirsiniz.</p>
                                </div>
                                <div className="space-y-2 p-3 bg-teal-50 dark:bg-teal-950/20 rounded-lg border border-teal-200 dark:border-teal-800">
                                    <Label htmlFor="pttavmCategoryId" className="text-teal-700 dark:text-teal-400 font-semibold text-xs uppercase tracking-wide">📮 ePttAVM Kategori Eşleştirme</Label>
                                    <MarketplaceCategoryField
                                        marketplace="pttavm"
                                        value={pttavmCategoryId}
                                        onChange={(id) => setPttavmCategoryId(toNumId(id))}
                                    />
                                    <p className="text-[10px] text-teal-600">ePttAVM kategorisini adıyla arayıp (örn: Bisiklet) seçebilirsiniz.</p>
                                </div>
                                <div className="space-y-2 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                                    <Label htmlFor="hbCategoryId" className="text-orange-700 dark:text-orange-400 font-semibold text-xs uppercase tracking-wide">🟠 Hepsiburada Kategori Eşleştirme</Label>
                                    <MarketplaceCategoryField
                                        marketplace="hepsiburada"
                                        value={hbCategoryId}
                                        onChange={setHbCategoryId}
                                    />
                                    <p className="text-[10px] text-orange-600">HB kategorisini adıyla arayıp seçebilirsiniz.</p>
                                </div>
                                <div className="space-y-2 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                                    <Label htmlFor="idefixCategoryId" className="text-purple-700 dark:text-purple-400 font-semibold text-xs uppercase tracking-wide">🟣 Idefix Kategori Eşleştirme</Label>
                                    <MarketplaceCategoryField
                                        marketplace="idefix"
                                        value={idefixCategoryId}
                                        onChange={(id) => setIdefixCategoryId(toNumId(id))}
                                    />
                                    <p className="text-[10px] text-purple-600">Idefix kategorisini adıyla arayıp (örn: Bisiklet) seçebilirsiniz.</p>
                                </div>
                                <div className="space-y-2 p-3 bg-pink-50 dark:bg-pink-950/20 rounded-lg border border-pink-200 dark:border-pink-800">
                                    <Label htmlFor="pazaramaCategoryId" className="text-pink-700 dark:text-pink-400 font-semibold text-xs uppercase tracking-wide">🌸 Pazarama Kategori Eşleştirme</Label>
                                    <MarketplaceCategoryField
                                        marketplace="pazarama"
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
                                    <MarketplaceCategoryField
                                        marketplace="ciceksepeti"
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
                                {isInHeader && (
                                    <div className="space-y-1.5 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800 animate-in fade-in duration-200">
                                        <Label htmlFor="headerOrder" className="text-blue-900 dark:text-blue-200 font-semibold text-xs uppercase tracking-wide">
                                            🔝 Üst Menü Sıralaması (Header Order)
                                        </Label>
                                        <Input
                                            id="headerOrder"
                                            type="number"
                                            value={headerOrder}
                                            onChange={(e) => setHeaderOrder(parseInt(e.target.value) || 0)}
                                            placeholder="Örn: 1, 2, 3..."
                                            className="bg-white dark:bg-gray-900 border-blue-300"
                                        />
                                        <p className="text-[11px] text-blue-700 dark:text-blue-300">
                                            Kategorinin üst menüdeki görünüm sırasını belirler (1, 2, 3...). Küçük sayılar solda görünür. Aksesuar ve Yedek Parça en sonda olmalıdır.
                                         </p>
                                    </div>
                                )}
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
