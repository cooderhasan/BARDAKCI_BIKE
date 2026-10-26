import { getAdminReviews } from "@/app/actions/review";
import { ReviewTable } from "@/components/admin/reviews/review-table";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Ürün Yorumları | Admin Paneli",
    description: "Ürün yorumlarını yönetin.",
};

export default async function AdminReviewsPage() {
    const reviews = await getAdminReviews();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Ürün Yorumları</h1>
                    <p className="text-muted-foreground">
                        Müşterilerin ürünler hakkında yaptığı yorumları buradan onaylayabilir veya reddedebilirsiniz.
                    </p>
                </div>
            </div>

            <ReviewTable initialReviews={reviews as any} />
        </div>
    );
}
