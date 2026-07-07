import { notFound } from "next/navigation";
import { getFAQ } from "@/app/actions/faq";
import { FAQForm } from "@/components/admin/faq-form";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function EditFAQPage({ params }: PageProps) {
    const { id } = await params;
    const faq = await getFAQ(id);

    if (!faq) {
        notFound();
    }

    return (
        <div className="p-6 space-y-6 max-w-4xl">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Soru Düzenle</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Sıkça sorulan sorunun detaylarını veya kategorisini güncelleyin.
                </p>
            </div>
            <FAQForm faq={faq} isNew={false} />
        </div>
    );
}
