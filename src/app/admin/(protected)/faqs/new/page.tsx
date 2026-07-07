import { FAQForm } from "@/components/admin/faq-form";

export default function NewFAQPage() {
    return (
        <div className="p-6 space-y-6 max-w-4xl">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Yeni Soru Ekle</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Müşteri veya bayileriniz için yeni bir yardım sorusu oluşturun.
                </p>
            </div>
            <FAQForm isNew={true} />
        </div>
    );
}
