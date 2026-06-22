"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ImageUpload } from "@/components/ui/image-upload";
import { createSlider, updateSlider } from "@/app/admin/(protected)/sliders/actions";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface SliderFormProps {
    initialData?: {
        id: string;
        title?: string | null;
        subtitle?: string | null;
        imageUrl: string;
        linkUrl?: string | null;
        order: number;
        isActive: boolean;
        showOverlay: boolean;
    };
    onSuccess?: () => void;
}

export function SliderForm({ initialData, onSuccess }: SliderFormProps) {
    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState(initialData?.title || "");
    const [subtitle, setSubtitle] = useState(initialData?.subtitle || "");
    const [linkUrl, setLinkUrl] = useState(initialData?.linkUrl || "");
    const [order, setOrder] = useState(initialData?.order || 0);
    const [isActive, setIsActive] = useState(initialData ? initialData.isActive : true);
    const [showOverlay, setShowOverlay] = useState(initialData ? initialData.showOverlay : true);
    const [images, setImages] = useState<string[]>(initialData?.imageUrl ? [initialData.imageUrl] : []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (images.length === 0) {
            toast.error("Lütfen bir görsel yükleyin.");
            return;
        }

        setLoading(true);
        const data = {
            title,
            subtitle,
            linkUrl,
            order: Number(order),
            isActive,
            showOverlay,
            imageUrl: images[0],
        };

        try {
            let result;
            if (initialData) {
                result = await updateSlider(initialData.id, data);
            } else {
                result = await createSlider(data);
            }

            if (result.success) {
                toast.success(initialData ? "Slider güncellendi." : "Slider oluşturuldu.");
                if (onSuccess) onSuccess();
            } else {
                toast.error(result.error || "Bir hata oluştu.");
            }
        } catch (error) {
            toast.error("Bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
                <Label>Görsel (Zorunlu)</Label>
                <div className="text-xs text-muted-foreground mb-2">
                    Önerilen boyut: <span className="font-bold">1920x600px</span>. Format: <span className="font-bold">JPG</span> veya <span className="font-bold">WebP</span>.
                    <br />
                    <span className="text-[10px] text-orange-600 font-medium italic">* Metinler sol tarafta olduğu için ana görsel objesinin sağ tarafta olması önerilir.</span>
                </div>
                <ImageUpload
                    value={images}
                    onChange={(urls) => setImages(urls)}
                    onRemove={(url) => setImages(images.filter((i) => i !== url))}
                    maxFiles={1}
                    disabled={loading}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Başlık</Label>
                    <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Slider Başlığı (Opsiyonel)"
                        disabled={loading}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Alt Başlık</Label>
                    <Input
                        value={subtitle}
                        onChange={(e) => setSubtitle(e.target.value)}
                        placeholder="Alt Başlık (Opsiyonel)"
                        disabled={loading}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Link URL</Label>
                    <Input
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="/urunler/yeni-sezon"
                        disabled={loading}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Sıralama</Label>
                    <Input
                        type="number"
                        value={order}
                        onChange={(e) => setOrder(Number(e.target.value))}
                        disabled={loading}
                    />
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6 border-t pt-4">
                <div className="flex items-center space-x-2">
                    <Switch
                        checked={isActive}
                        onCheckedChange={setIsActive}
                        id="is-active"
                        disabled={loading}
                    />
                    <Label htmlFor="is-active" className="text-sm font-medium">Slider Aktif</Label>
                </div>

                <div className="flex items-center space-x-2">
                    <Switch
                        checked={showOverlay}
                        onCheckedChange={setShowOverlay}
                        id="show-overlay"
                        disabled={loading}
                    />
                    <div className="grid gap-0.5 leading-none">
                        <Label htmlFor="show-overlay" className="text-sm font-medium">Yazı ve Buton Katmanını Göster</Label>
                        <p className="text-[11px] text-muted-foreground">Görselin üzerindeki başlık, alt başlık ve "Keşfet" butonunu gizlemek için kapatın.</p>
                    </div>
                </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {initialData ? "Güncelle" : "Oluştur"}
            </Button>
        </form>
    );
}
