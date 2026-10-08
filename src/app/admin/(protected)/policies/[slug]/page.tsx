import { notFound } from "next/navigation";
import { getPolicy } from "@/app/actions/policy";
import { PolicyEditor } from "@/components/admin/policy-editor";

interface PageProps {
    params: Promise<{ slug: string }>;
}

export default async function EditPolicyPage({ params }: PageProps) {
    const { slug } = await params;
    const policy = await getPolicy(slug);

    if (!policy) {
        notFound();
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold tracking-tight">Politika Düzenle: {policy.title}</h1>
            </div>
            <PolicyEditor policy={policy} />
        </div>
    );
}
