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
import { Plus, Pencil, Trash2, Upload, X } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { createSlider, updateSlider, deleteSlider, toggleSliderStatus } from "@/app/admin/(protected)/sliders/actions";

interface Slider {
    id: string;
    title: string | null;
    subtitle: string | null;
    imageUrl: string;
    linkUrl: string | null;
    store?: "BIKE" | "MOTOR" | "BOTH";
    order: number;
    isActive: boolean;
    createdAt: Date;
}

interface SlidersTableProps {
    sliders: Slider[];
}

export function SlidersTable({ sliders }: SlidersTableProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [editSlider, setEditSlider] = useState<Slider | null>(null);
    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState("");
    const [subtitle, setSubtitle] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [linkUrl, setLinkUrl] = useState("");
    const [order, setOrder] = useState(0);
    const [uploading, setUploading] = useState(false);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (response.ok) {
                const data = await response.json();
                setImageUrl(data.url);
                toast.success("Görsel yüklendi.");
            } else {
                const data = await response.json();
                toast.error(`Hata: ${data.error || "Bilinmeyen sunucu hatası"}`);
            }
        } catch (error) {
            console.error("Upload error", error);
            toast.error("Görsel yüklenirken hata oluştu.");
        } finally {
            setUploading(false);
        }
        e.target.value = ""; // Reset input
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!imageUrl) {
            toast.error("Lütfen bir görsel yükleyin.");
            return;
        }

        setLoading(true);

        try {
            if (editSlider) {
                await updateSlider(editSlider.id, { title, subtitle, imageUrl, linkUrl, order });
                toast.success("Slider güncellendi.");
            } else {
                await createSlider({ title, subtitle, imageUrl, linkUrl, order, isActive: true });
                toast.success("Slider oluşturuldu.");
            }
            setIsOpen(false);
            resetForm();
        } catch {
            toast.error("Bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Bu slider'ı silmek istediğinize emin misiniz?")) return;

        try {
            await deleteSlider(id);
            toast.success("Slider silindi.");
        } catch {
            toast.error("Bir hata oluştu.");
        }
    };

    const handleToggleStatus = async (id: string, isActive: boolean) => {
        try {
            await toggleSliderStatus(id, isActive);
            toast.success(isActive ? "Slider aktifleştirildi." : "Slider pasifleştirildi.");
        } catch {
            toast.error("Bir hata oluştu.");
        }
    };

    const resetForm = () => {
        setTitle("");
        setSubtitle("");
        setImageUrl("");
        setLinkUrl("");
        setOrder(0);
        setEditSlider(null);
    };

    const openEditDialog = (slider: Slider) => {
        setEditSlider(slider);
        setTitle(slider.title || "");
        setSubtitle(slider.subtitle || "");
        setImageUrl(slider.imageUrl);
        setLinkUrl(slider.linkUrl || "");
        setOrder(slider.order);
        setIsOpen(true);
    };

    const openNewDialog = () => {
        resetForm();
        setIsOpen(true);
    };

    return (
        <>
            <div className="flex justify-end mb-4">
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={openNewDialog}>
                            <Plus className="h-4 w-4 mr-2" />
                            Yeni Slider
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {editSlider ? "Slider Düzenle" : "Yeni Slider"}
                            </DialogTitle>
                            <DialogDescription>
                                Slider bilgilerini girin
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit}>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="title">Başlık</Label>
                                    <Input
                                        id="title"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Slider başlığı"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="subtitle">Alt Başlık</Label>
                                    <Input
                                        id="subtitle"
                                        value={subtitle}
                                        onChange={(e) => setSubtitle(e.target.value)}
                                        placeholder="Slider alt başlığı"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Görsel</Label>
                                    {imageUrl ? (
                                        <div className="relative w-full h-[150px] rounded-md overflow-hidden border">
                                            <button
                                                type="button"
                                                onClick={() => setImageUrl("")}
                                                className="absolute top-2 right-2 z-10 bg-red-500 hover:bg-red-600 text-white rounded-full p-1"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                            <img
                                                className="object-cover w-full h-full"
                                                alt="Slider görseli"
                                                src={imageUrl}
                                            />
                                        </div>
                                    ) : (
                                        <label
                                            htmlFor="slider-image-upload"
                                            className={`
                                                cursor-pointer
                                                flex flex-col items-center justify-center
                                                w-full h-[150px]
                                                border-2 border-dashed border-gray-300 rounded-md
                                                hover:bg-gray-50 transition-colors
                                                ${uploading ? "opacity-50 cursor-not-allowed" : ""}
                                            `}
                                        >
                                            <div className="flex flex-col items-center justify-center">
                                                {uploading ? (
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
                                                ) : (
                                                    <>
                                                        <Upload className="h-8 w-8 text-gray-400 mb-2" />
                                                        <p className="text-sm text-gray-500">Görsel Yükle</p>
                                                        <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP</p>
                                                    </>
                                                )}
                                            </div>
                                            <input
                                                id="slider-image-upload"
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleFileUpload}
                                                disabled={uploading}
                                            />
                                        </label>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="linkUrl">Link URL</Label>
                                    <Input
                                        id="linkUrl"
                                        value={linkUrl}
                                        onChange={(e) => setLinkUrl(e.target.value)}
                                        placeholder="/products"
                                    />
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
                            <TableHead>Sıra</TableHead>
                            <TableHead>Görsel</TableHead>
                            <TableHead>Başlık</TableHead>
                            <TableHead>Link</TableHead>
                            <TableHead>Durum</TableHead>
                            <TableHead className="text-right">İşlemler</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sliders.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                    Henüz slider bulunmuyor.
                                </TableCell>
                            </TableRow>
                        ) : (
                            sliders.map((slider) => (
                                <TableRow key={slider.id}>
                                    <TableCell>{slider.order}</TableCell>
                                    <TableCell>
                                        {slider.imageUrl ? (
                                            <img
                                                src={slider.imageUrl}
                                                alt={slider.title || "Slider"}
                                                className="h-12 w-20 object-cover rounded"
                                            />
                                        ) : (
                                            <span className="text-gray-400">-</span>
                                        )}
                                    </TableCell>
                                     <TableCell>
                                         <div>
                                             <div className="flex items-center gap-1.5">
                                                 <p className="font-medium">{slider.title || "-"}</p>
                                                 {slider.store === "MOTOR" ? (
                                                     <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">🏍️ Motor</span>
                                                 ) : slider.store === "BOTH" ? (
                                                     <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">🌐 Ortak</span>
                                                 ) : (
                                                     <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">🚲 Bisiklet</span>
                                                 )}
                                             </div>
                                             <p className="text-sm text-gray-500">{slider.subtitle || ""}</p>
                                         </div>
                                     </TableCell>
                                    <TableCell className="text-gray-500">
                                        {slider.linkUrl || "-"}
                                    </TableCell>
                                    <TableCell>
                                        <Switch
                                            checked={slider.isActive}
                                            onCheckedChange={(checked) =>
                                                handleToggleStatus(slider.id, checked)
                                            }
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => openEditDialog(slider)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-red-600 hover:text-red-700"
                                                onClick={() => handleDelete(slider.id)}
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
