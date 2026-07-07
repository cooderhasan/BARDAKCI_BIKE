import { FAQsTable } from "@/components/admin/faqs-table";
import { getAllFAQs } from "@/app/actions/faq";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function FAQsPage() {
    const faqs = await getAllFAQs();

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Sıkça Sorulan Sorular (S.S.S)</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Sitenizin yardım merkezindeki soruları ve kategorileri yönetin.
                    </p>
                </div>
                <Link href="/admin/faqs/new">
                    <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Yeni Soru Ekle
                    </Button>
                </Link>
            </div>
            <FAQsTable faqs={faqs} />
        </div>
    );
}
