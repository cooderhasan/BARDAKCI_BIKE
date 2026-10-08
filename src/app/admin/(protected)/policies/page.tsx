import { PoliciesTable } from "@/components/admin/policies-table";
import { getAllPolicies } from "@/app/actions/policy";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export default async function PoliciesPage() {
    const policies = await getAllPolicies();

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold tracking-tight">Politika ve Sözleşmeler</h1>
                <Link href="/admin/policies/new">
                    <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Yeni Politika
                    </Button>
                </Link>
            </div>
            <PoliciesTable policies={policies} />
        </div>
    );
}
