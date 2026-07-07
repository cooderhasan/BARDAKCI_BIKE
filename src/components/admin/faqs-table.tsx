"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { deleteFAQ, toggleFAQStatus } from "@/app/actions/faq";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface FAQ {
    id: string;
    question: string;
    answer: string;
    category: string;
    order: number;
    isActive: boolean;
}

const CATEGORY_MAP: Record<string, string> = {
    membership: "Üyelik & Bayilik",
    orders: "Sipariş & Ödeme",
    shipping: "Teslimat & Kargo",
    service: "Kurulum, Garanti & İade",
    general: "Genel"
};

export function FAQsTable({ faqs }: { faqs: FAQ[] }) {
    const router = useRouter();
    const [deleting, setDeleting] = useState<string | null>(null);
    const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

    const handleDelete = async (id: string) => {
        if (!confirm("Bu soruyu silmek istediğinizden emin misiniz?")) return;

        setDeleting(id);
        try {
            const result = await deleteFAQ(id);
            if (result.success) {
                toast.success("Soru başarıyla silindi");
                router.refresh();
            } else {
                toast.error(result.error || "Silme işlemi başarısız");
            }
        } catch {
            toast.error("Bir hata oluştu");
        } finally {
            setDeleting(null);
        }
    };

    const handleToggleStatus = async (id: string, currentStatus: boolean) => {
        setUpdatingStatus(id);
        try {
            const result = await toggleFAQStatus(id, !currentStatus);
            if (result.success) {
                toast.success("Soru durumu güncellendi");
                router.refresh();
            } else {
                toast.error(result.error || "Durum güncellenemedi");
            }
        } catch {
            toast.error("Bir hata oluştu");
        } finally {
            setUpdatingStatus(null);
        }
    };

    return (
        <div className="rounded-md border bg-white dark:bg-gray-800">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[80px]">Sıra</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead>Soru</TableHead>
                        <TableHead>Durum</TableHead>
                        <TableHead className="text-right">İşlemler</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {faqs.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                                Kayıtlı sıkça sorulan soru bulunmuyor.
                            </TableCell>
                        </TableRow>
                    ) : (
                        faqs.map((faq) => (
                            <TableRow key={faq.id}>
                                <TableCell className="font-semibold text-gray-600 dark:text-gray-400">
                                    {faq.order}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary">
                                        {CATEGORY_MAP[faq.category] || faq.category}
                                    </Badge>
                                </TableCell>
                                <TableCell className="font-medium max-w-md truncate">
                                    {faq.question}
                                </TableCell>
                                <TableCell>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-2"
                                        onClick={() => handleToggleStatus(faq.id, faq.isActive)}
                                        disabled={updatingStatus === faq.id}
                                    >
                                        {faq.isActive ? (
                                            <span className="flex items-center text-green-600 gap-1.5 text-xs font-semibold">
                                                <CheckCircle2 className="h-4 w-4" /> Aktif
                                            </span>
                                        ) : (
                                            <span className="flex items-center text-red-500 gap-1.5 text-xs font-semibold">
                                                <XCircle className="h-4 w-4" /> Pasif
                                            </span>
                                        )}
                                    </Button>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Link href={`/admin/faqs/${faq.id}`}>
                                            <Button variant="ghost" size="sm">
                                                <Pencil className="h-4 w-4 mr-1.5" />
                                                Düzenle
                                            </Button>
                                        </Link>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => handleDelete(faq.id)}
                                            disabled={deleting === faq.id}
                                        >
                                            <Trash2 className="h-4 w-4 mr-1.5" />
                                            {deleting === faq.id ? "Siliniyor..." : "Sil"}
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
