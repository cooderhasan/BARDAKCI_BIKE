"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createFAQ, updateFAQ } from "@/app/actions/faq";
import { toast } from "sonner";

interface FAQ {
    id: string;
    question: string;
    answer: string;
    category: string;
    order: number;
    isActive: boolean;
}

export function FAQForm({ faq, isNew = false }: { faq?: FAQ; isNew?: boolean }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    
    const [question, setQuestion] = useState(faq?.question || "");
    const [answer, setAnswer] = useState(faq?.answer || "");
    const [category, setCategory] = useState(faq?.category || "general");
    const [order, setOrder] = useState(faq?.order !== undefined ? faq.order : 0);
    const [isActive, setIsActive] = useState(faq?.isActive !== undefined ? faq.isActive : true);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!question || !answer) {
            toast.error("Soru ve Cevap alanları zorunludur");
            return;
        }

        setLoading(true);

        const data = {
            question,
            answer,
            category,
            order: Number(order),
            isActive,
        };

        try {
            let result;
            if (isNew) {
                result = await createFAQ(data);
            } else {
                result = await updateFAQ(faq!.id, data);
            }

            if (result.success) {
                toast.success(isNew ? "Soru başarıyla eklendi" : "Soru başarıyla güncellendi");
                router.refresh();
                router.push("/admin/faqs");
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
        <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-gray-800 p-6 md:p-8 rounded-xl border border-gray-100 dark:border-gray-700">
            <div className="space-y-2">
                <Label htmlFor="question">Soru</Label>
                <Input
                    id="question"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Örn: Bisiklet kurulumunu nerede yaptırabilirim?"
                    required
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="answer">Cevap</Label>
                <textarea
                    id="answer"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Örn: Satın aldığınız bisikletlerin garanti kapsamına girmesi için en yakın yetkili servisinde kurulumunu yaptırmalısınız..."
                    className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700"
                    required
                />
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                    <Label htmlFor="category">Kategori</Label>
                    <select
                        id="category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800"
                    >
                        <option value="general">Genel</option>
                        <option value="membership">Üyelik & Bayilik</option>
                        <option value="orders">Sipariş & Ödeme</option>
                        <option value="shipping">Teslimat & Kargo</option>
                        <option value="service">Kurulum, Garanti & İade</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="order">Görüntüleme Sırası</Label>
                    <Input
                        id="order"
                        type="number"
                        value={order}
                        onChange={(e) => setOrder(Number(e.target.value))}
                        placeholder="Örn: 0"
                        min={0}
                        required
                    />
                </div>

                <div className="space-y-2 flex flex-col justify-end pb-1.5">
                    <div className="flex items-center gap-2">
                        <input
                            id="isActive"
                            type="checkbox"
                            checked={isActive}
                            onChange={(e) => setIsActive(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <Label htmlFor="isActive" className="cursor-pointer font-semibold text-gray-700 dark:text-gray-200">
                            Sitede Aktif Olarak Göster
                        </Label>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 dark:border-gray-700">
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
