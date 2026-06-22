"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { submitReview } from "@/app/actions/review";
import { cn } from "@/lib/utils";

interface ReviewFormProps {
    productId: string;
}

export function ReviewForm({ productId }: ReviewFormProps) {
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState("");
    const [hoveredRating, setHoveredRating] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (rating === 0) {
            toast.error("Lütfen bir puan verin.");
            return;
        }
        if (comment.trim().length < 5) {
            toast.error("Lütfen en az 5 karakterlik bir yorum yazın.");
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await submitReview(productId, rating, comment);
            if (result.success) {
                toast.success("Değerlendirmeniz alındı. Onaylandıktan sonra yayınlanacaktır.");
                setRating(0);
                setComment("");
            } else {
                toast.error(result.error || "Bir hata oluştu.");
            }
        } catch (error) {
            toast.error("Bir hata oluştu.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-100 dark:border-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white">Değerlendirme Yap</h3>

            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        className="p-1 focus:outline-none transition-transform hover:scale-110"
                    >
                        <Star
                            className={cn(
                                "w-6 h-6 transition-colors",
                                (hoveredRating || rating) >= star
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-gray-300 dark:text-gray-600"
                            )}
                        />
                    </button>
                ))}
            </div>

            <Textarea
                placeholder="Ürün hakkındaki düşüncelerinizi yazın..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[100px] resize-none bg-white dark:bg-gray-900"
            />

            <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#17457C] hover:bg-[#0f3460] text-white"
            >
                {isSubmitting ? "Gönderiliyor..." : "Değerlendirmeyi Gönder"}
            </Button>
        </form>
    );
}
