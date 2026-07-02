"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { X, Plus, Pencil, Trash2, Search, Sparkles, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { 
    createBlogPost, 
    updateBlogPost, 
    deleteBlogPost, 
    toggleBlogPostStatus 
} from "@/app/admin/(protected)/blog/actions";

interface BlogPost {
    id: string;
    title: string;
    slug: string;
    content: string;
    summary: string | null;
    imageUrl: string | null;
    isActive: boolean;
    readTime: number;
    viewCount: number;
    createdAt: Date;
    updatedAt: Date;
}

interface BlogTableProps {
    posts: BlogPost[];
}

export function BlogTable({ posts }: BlogTableProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [editPost, setEditPost] = useState<BlogPost | null>(null);
    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);

    // Form States
    const [title, setTitle] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [summary, setSummary] = useState("");
    const [content, setContent] = useState("");
    const [readTime, setReadTime] = useState(5);
    const [isActive, setIsActive] = useState(true);

    const [searchTerm, setSearchTerm] = useState("");
    const [uploading, setUploading] = useState(false);

    // Filter posts
    const filteredPosts = posts.filter(post => 
        post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (post.summary || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    const resetForm = () => {
        setTitle("");
        setImageUrl("");
        setSummary("");
        setContent("");
        setReadTime(5);
        setIsActive(true);
        setEditPost(null);
    };

    const openEditDialog = (post: BlogPost) => {
        setEditPost(post);
        setTitle(post.title);
        setImageUrl(post.imageUrl || "");
        setSummary(post.summary || "");
        setContent(post.content);
        setReadTime(post.readTime);
        setIsActive(post.isActive);
        setIsOpen(true);
    };

    const openNewDialog = () => {
        resetForm();
        setIsOpen(true);
    };

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
            toast.success("Kapak resmi yüklendi.");
        } catch {
            toast.error("Resim yüklenirken hata oluştu.");
        } finally {
            setUploading(false);
        }
    };

    const handleAIGenerate = async () => {
        if (!title.trim()) {
            toast.error("Lütfen önce bir yazı başlığı girin.");
            return;
        }

        setAiLoading(true);
        try {
            const res = await fetch("/api/admin/ai/generate-blog", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "İçerik üretilemedi.");

            setContent(data.content);
            setSummary(data.summary);
            
            // Okuma süresini kelime sayısına göre hesapla (ortalama dk'da 180 kelime)
            const wordCount = data.content.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;
            const calculatedReadTime = Math.max(2, Math.ceil(wordCount / 180));
            setReadTime(calculatedReadTime);

            toast.success("AI blog içeriği başarıyla oluşturuldu!");
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Yapay zeka ile içerik üretilirken bir hata oluştu.");
        } finally {
            setAiLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !content.trim()) {
            toast.error("Başlık ve içerik alanları zorunludur.");
            return;
        }

        setLoading(true);
        try {
            let result;
            if (editPost) {
                result = await updateBlogPost(editPost.id, {
                    title,
                    content,
                    summary: summary || undefined,
                    imageUrl: imageUrl || undefined,
                    isActive,
                    readTime
                });
            } else {
                result = await createBlogPost({
                    title,
                    content,
                    summary: summary || undefined,
                    imageUrl: imageUrl || undefined,
                    isActive,
                    readTime
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
            toast.error("Kaydedilirken bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Bu yazıyı silmek istediğinize emin misiniz?")) return;

        try {
            const result = await deleteBlogPost(id);
            if (result.success) {
                toast.success(result.message);
            } else {
                toast.error(result.message);
            }
        } catch {
            toast.error("Bir hata oluştu.");
        }
    };

    const handleToggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            const result = await toggleBlogPostStatus(id, !currentStatus);
            if (result.success) {
                toast.success(!currentStatus ? "Yazı aktifleştirildi." : "Yazı pasifleştirildi.");
            } else {
                toast.error("Durum güncellenemedi.");
            }
        } catch {
            toast.error("Bir hata oluştu.");
        }
    };

    return (
        <>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                <div className="relative w-full sm:w-72">
                    <Input
                        placeholder="Blog Yazılarında Ara..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                </div>

                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={openNewDialog}>
                            <Plus className="h-4 w-4 mr-2" />
                            Yeni Yazı Ekle
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>
                                {editPost ? "Yazıyı Düzenle" : "Yeni Blog Yazısı"}
                            </DialogTitle>
                            <DialogDescription>
                                Blog içeriğini girin veya yapay zeka ile otomatik oluşturun
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit}>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="title">Yazı Başlığı</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="title"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            placeholder="Örn: 20 Jant Çocuk Bisikleti Seçim Rehberi"
                                            required
                                            className="flex-1"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 dark:bg-indigo-950/20 dark:border-indigo-800 dark:text-indigo-400"
                                            disabled={aiLoading}
                                            onClick={handleAIGenerate}
                                        >
                                            {aiLoading ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                                <Sparkles className="h-4 w-4 mr-2" />
                                            )}
                                            AI ile Yazdır
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Okuma Süresi (Dakika)</Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            value={readTime}
                                            onChange={(e) => setReadTime(parseInt(e.target.value) || 5)}
                                        />
                                    </div>
                                    <div className="flex items-center space-x-2 pt-8">
                                        <Switch
                                            id="isActive"
                                            checked={isActive}
                                            onCheckedChange={setIsActive}
                                        />
                                        <Label htmlFor="isActive">Yayında (Aktif)</Label>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Kapak Görseli</Label>
                                    <div className="flex items-center gap-4">
                                        {imageUrl && (
                                            <div className="relative w-24 h-16 border rounded-md overflow-hidden">
                                                <img src={imageUrl} alt="Kapak" className="object-cover w-full h-full" />
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
                                    <Label htmlFor="summary">Kısa Özet (SEO Meta Açıklaması)</Label>
                                    <Textarea
                                        id="summary"
                                        value={summary}
                                        onChange={(e) => setSummary(e.target.value)}
                                        placeholder="Kategori kartlarında ve Google arama sonuçlarında görünecek kısa yazı özeti..."
                                        rows={2}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Yazı İçeriği (Zengin Metin)</Label>
                                    <RichTextEditor
                                        content={content}
                                        onChange={setContent}
                                        placeholder="Yazı içeriğini buraya girin veya AI butonunu kullanın..."
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

            <div className="rounded-lg border bg-white dark:bg-gray-800 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px]">Görsel</TableHead>
                            <TableHead>Yazı Başlığı</TableHead>
                            <TableHead>Eklenme Tarihi</TableHead>
                            <TableHead>Okuma Süresi</TableHead>
                            <TableHead>Okunma</TableHead>
                            <TableHead>Durum</TableHead>
                            <TableHead className="text-right">İşlemler</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredPosts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                                    {searchTerm ? "Sonuç bulunamadı." : "Henüz blog yazısı eklenmemiş."}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredPosts.map((post) => (
                                <TableRow key={post.id}>
                                    <TableCell>
                                        <div className="w-16 h-10 border rounded overflow-hidden bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                                            {post.imageUrl ? (
                                                <img src={post.imageUrl} alt={post.title} className="object-cover w-full h-full" />
                                            ) : (
                                                <span className="text-[10px] text-gray-400">Görsel Yok</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium max-w-xs truncate">
                                        {post.title}
                                    </TableCell>
                                    <TableCell className="text-sm text-gray-500">
                                        {new Date(post.createdAt).toLocaleDateString("tr-TR")}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {post.readTime} Dk
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {post.viewCount} Okuma
                                    </TableCell>
                                    <TableCell>
                                        <Switch
                                            checked={post.isActive}
                                            onCheckedChange={() => handleToggleStatus(post.id, post.isActive)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => openEditDialog(post)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                                onClick={() => handleDelete(post.id)}
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
