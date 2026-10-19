"use client";

import { useState } from "react";
import { Slider } from "@prisma/client";
import { Button } from "@/components/ui/button";
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
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Pencil, Trash, Loader2 } from "lucide-react";
import Image from "next/image";
import { SliderForm } from "@/components/admin/slider-form";
import { deleteSlider, updateSlider } from "@/app/admin/(protected)/sliders/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface SlidersClientProps {
    initialSliders: Slider[];
}

export function SlidersClient({ initialSliders }: SlidersClientProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [editingSlider, setEditingSlider] = useState<Slider | null>(null);

    // Optimistic UI updates could be added here, but relying on router.refresh() 
    // triggered by server actions for simplicity.

    const handleDelete = async (id: string) => {
        if (!confirm("Bu slider'ı silmek istediğinize emin misiniz?")) return;

        try {
            const result = await deleteSlider(id);
            if (result.success) {
                toast.success("Slider silindi.");
            } else {
                toast.error(result.error);
            }
        } catch (error) {
            toast.error("Silme işlemi başarısız.");
        }
    };

    const handleToggleActive = async (slider: Slider) => {
        try {
            await updateSlider(slider.id, { isActive: !slider.isActive });
            toast.success("Durum güncellendi.");
        } catch (error) {
            toast.error("Güncelleme başarısız.");
        }
    };

    const handleEdit = (slider: Slider) => {
        setEditingSlider(slider);
        setOpen(true);
    };

    const handleSuccess = () => {
        setOpen(false);
        setEditingSlider(null);
        router.refresh();
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Slider Yönetimi</h2>
                    <p className="text-muted-foreground">
                        Anasayfa manşet alanını buradan yönetebilirsiniz.
                    </p>
                    <div className="mt-2 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 p-2 rounded-md border border-blue-100 dark:border-blue-800 inline-block">
                        <span className="font-bold">İdeal Slider Ölçüsü:</span> 2200x1000px (oran 2.2:1) | <span className="font-bold">Format:</span> JPG/PNG/WebP
                        <br />
                        <span className="italic">* Yazı ve logoları kenarlardan biraz içeride tutun; geniş ekranda üstten ve alttan az bir kısım kırpılabilir.</span>
                    </div>
                </div>
                <Dialog open={open} onOpenChange={(val) => {
                    setOpen(val);
                    if (!val) setEditingSlider(null);
                }}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Yeni Ekle
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                            <DialogTitle>
                                {editingSlider ? "Slider Düzenle" : "Yeni Slider Ekle"}
                            </DialogTitle>
                        </DialogHeader>
                        <SliderForm
                            initialData={editingSlider || undefined} // Convert null to undefined
                            onSuccess={handleSuccess}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Sıra</TableHead>
                            <TableHead>Görsel</TableHead>
                            <TableHead>Başlık</TableHead>
                            <TableHead>Link</TableHead>
                            <TableHead>Durum</TableHead>
                            <TableHead className="w-[70px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {initialSliders.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    Henüz hiç slider eklenmemiş.
                                </TableCell>
                            </TableRow>
                        ) : (
                            initialSliders.map((slider) => (
                                <TableRow key={slider.id}>
                                    <TableCell>{slider.order}</TableCell>
                                    <TableCell>
                                        <div className="relative w-24 h-12 rounded overflow-hidden">
                                            <Image
                                                src={slider.imageUrl}
                                                alt={slider.title || "Slider"}
                                                fill
                                                className="object-cover"
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium">{slider.title || "-"}</div>
                                        <div className="text-xs text-muted-foreground">{slider.subtitle}</div>
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                                        {slider.linkUrl || "-"}
                                    </TableCell>
                                    <TableCell>
                                        <Switch
                                            checked={slider.isActive}
                                            onCheckedChange={() => handleToggleActive(slider)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Menü</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>İşlemler</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => handleEdit(slider)}>
                                                    <Pencil className="mr-2 h-4 w-4" /> Düzenle
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => handleDelete(slider.id)}
                                                    className="text-red-600"
                                                >
                                                    <Trash className="mr-2 h-4 w-4" /> Sil
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
