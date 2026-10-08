import { PolicyEditor } from "@/components/admin/policy-editor";

export default function NewPolicyPage() {
    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold tracking-tight">Yeni Politika Oluştur</h1>
            </div>
            <PolicyEditor isNew={true} />
        </div>
    );
}
