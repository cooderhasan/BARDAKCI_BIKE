"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePolicy } from "@/app/actions/policy";
import { toast } from "sonner";
import dynamic from "next/dynamic";
const RichTextEditor = dynamic(
    () => import("@/components/admin/rich-text-editor").then((mod) => mod.RichTextEditor),
    { ssr: false }
);

interface Policy {
    slug: string;
    title: string;
    content: string;
}

export function PolicyEditor({ policy, isNew = false }: { policy?: Policy, isNew?: boolean }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState(policy?.title || "");
    const [slug, setSlug] = useState(policy?.slug || "");
    const [content, setContent] = useState(policy?.content || "");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!slug || !title) {
            toast.error("Başlık ve Slug alanları zorunludur");
            return;
        }

        setLoading(true);

        try {
            const result = await updatePolicy(slug, title, content);
            if (result.success) {
                toast.success(isNew ? "Politika oluşturuldu" : "Politika güncellendi");
                router.refresh();
                router.push("/admin/policies");
            } else {
                toast.error(result.error || "İşlem başarısız");
            }
        } catch {
            toast.error("Bir hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg border">
            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="title">Başlık</Label>
                    <Input
                        id="title"
                        value={title}
                        onChange={(e) => {
                            setTitle(e.target.value);
                            if (isNew && !policy?.slug) {
                                // Simple slug generation: lowercase, replace spaces with hyphen
                                setSlug(e.target.value.toLowerCase()
                                    .replace(/[^a-z0-9]/g, '-')
                                    .replace(/-+/g, '-')
                                    .replace(/^-|-$/g, ''));
                            }
                        }}
                        placeholder="Örn: Kargo ve Teslimat"
                        required
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="slug">Slug (URL Bağlantısı)</Label>
                    <Input
                        id="slug"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                        placeholder="Örn: kargo-ve-teslimat"
                        disabled={!isNew}
                        required
                    />
                    <p className="text-xs text-gray-500">
                        {isNew ? "Bu alan geri alınamaz, lütfen dikkatli seçin." : "Slug değiştirilemez."}
                    </p>
                </div>
            </div>

            <div className="space-y-2">
                <Label>İçerik</Label>
                <RichTextEditor
                    content={content}
                    onChange={setContent}
                />
            </div>

            <div className="flex justify-end gap-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    disabled={loading}
                >
                    İptal
                </Button>
                <Button type="submit" disabled={loading}>
                    {loading ? "Kaydediliyor..." : "Kaydet"}
                </Button>
            </div>
        </form>
    );
}
