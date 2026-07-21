"use client";

import { useState } from "react";
import { Banner } from "@prisma/client";
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
import { Plus, MoreHorizontal, Pencil, Trash, ExternalLink } from "lucide-react";
import Image from "next/image";
import { BannerForm } from "@/components/admin/banner-form";
import { deleteBanner, updateBanner } from "@/app/admin/(protected)/banners/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface BannersClientProps {
    initialBanners: Banner[];
}

export function BannersClient({ initialBanners }: BannersClientProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [editingBanner, setEditingBanner] = useState<Banner | null>(null);

    const handleDelete = async (id: string) => {
        if (!confirm("Bu banner'ı silmek istediğinize emin misiniz?")) return;

        try {
            const result = await deleteBanner(id);
            if (result.success) {
                toast.success("Banner silindi.");
            } else {
                toast.error(result.error);
            }
        } catch (error) {
            toast.error("Silme işlemi başarısız.");
        }
    };

    const handleToggleActive = async (banner: Banner) => {
        try {
            await updateBanner(banner.id, { isActive: !banner.isActive });
            toast.success("Durum güncellendi.");
        } catch (error) {
            toast.error("Güncelleme başarısız.");
        }
    };

    const handleEdit = (banner: Banner) => {
        setEditingBanner(banner);
        setOpen(true);
    };

    const handleSuccess = () => {
        setOpen(false);
        setEditingBanner(null);
        router.refresh();
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Banner Yönetimi</h2>
                    <p className="text-muted-foreground">
                        Anasayfa altındaki 3'lü banner alanını buradan yönetebilirsiniz.
                    </p>
                    <div className="mt-2 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 p-2 rounded-md border border-blue-100 dark:border-blue-800 inline-block">
                        <span className="font-bold">İdeal Banner Ölçüsü:</span> 800x500px | <span className="font-bold">Format:</span> JPG/WebP
                    </div>
                </div>
                <Dialog open={open} onOpenChange={(val) => {
                    setOpen(val);
                    if (!val) setEditingBanner(null);
                }}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Yeni Banner Ekle
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                            <DialogTitle>
                                {editingBanner ? "Banner Düzenle" : "Yeni Banner Ekle"}
                            </DialogTitle>
                        </DialogHeader>
                        <BannerForm
                            initialData={editingBanner || undefined}
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
                        {initialBanners.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    Henüz hiç banner eklenmemiş.
                                </TableCell>
                            </TableRow>
                        ) : (
                            initialBanners.map((banner) => (
                                <TableRow key={banner.id}>
                                    <TableCell>{banner.order}</TableCell>
                                    <TableCell>
                                        <div className="relative w-24 h-16 rounded overflow-hidden bg-gray-100">
                                            <Image
                                                src={banner.imageUrl}
                                                alt={banner.title || "Banner"}
                                                fill
                                                className="object-cover"
                                                sizes="96px"
                                            />
                                        </div>
                                    </TableCell>
                                     <TableCell>
                                         <div className="flex items-center gap-1.5">
                                             <span className="font-medium">{banner.title || "-"}</span>
                                             {(banner as any).store === "MOTOR" ? (
                                                 <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">🏍️ Motor</span>
                                             ) : (banner as any).store === "BOTH" ? (
                                                 <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">🌐 Ortak</span>
                                             ) : (
                                                 <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">🚲 Bisiklet</span>
                                             )}
                                         </div>
                                     </TableCell>
                                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                                        {banner.linkUrl ? (
                                            <a href={banner.linkUrl} target="_blank" rel="noreferrer" className="flex items-center hover:underline">
                                                {banner.linkUrl} <ExternalLink className="ml-1 h-3 w-3" />
                                            </a>
                                        ) : "-"}
                                    </TableCell>
                                    <TableCell>
                                        <Switch
                                            checked={banner.isActive}
                                            onCheckedChange={() => handleToggleActive(banner)}
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
                                                <DropdownMenuItem onClick={() => handleEdit(banner)}>
                                                    <Pencil className="mr-2 h-4 w-4" /> Düzenle
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => handleDelete(banner.id)}
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
