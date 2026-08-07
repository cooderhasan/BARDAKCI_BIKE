"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { deletePolicy } from "@/app/actions/policy";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Policy {
    slug: string;
    title: string;
    updatedAt: Date;
}

export function PoliciesTable({ policies }: { policies: Policy[] }) {
    const router = useRouter();
    const [deleting, setDeleting] = useState<string | null>(null);

    const handleDelete = async (slug: string) => {
        if (!confirm("Bu politikayı silmek istediğinizden emin misiniz?")) return;

        setDeleting(slug);
        try {
            const result = await deletePolicy(slug);
            if (result.success) {
                toast.success("Politika silindi");
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

    return (
        <div className="rounded-md border bg-white dark:bg-gray-800">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Başlık</TableHead>
                        <TableHead>Slug (Bağlantı)</TableHead>
                        <TableHead>Son Güncelleme</TableHead>
                        <TableHead className="text-right">İşlem</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {policies.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                                Kayıtlı politika bulunmuyor.
                            </TableCell>
                        </TableRow>
                    ) : (
                        policies.map((policy) => (
                            <TableRow key={policy.slug}>
                                <TableCell className="font-medium">{policy.title}</TableCell>
                                <TableCell className="text-gray-500">{policy.slug}</TableCell>
                                <TableCell>
                                    {policy.updatedAt ? format(new Date(policy.updatedAt), "d MMM yyyy HH:mm", { locale: tr }) : "Sistem Varsayılanı"}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Link href={`/admin/policies/${policy.slug}`}>
                                            <Button variant="ghost" size="sm">
                                                <Pencil className="h-4 w-4 mr-2" />
                                                Düzenle
                                            </Button>
                                        </Link>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => handleDelete(policy.slug)}
                                            disabled={deleting === policy.slug}
                                        >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            {deleting === policy.slug ? "Siliniyor..." : "Sil"}
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
