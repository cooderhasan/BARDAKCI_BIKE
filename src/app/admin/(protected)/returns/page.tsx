import { getAdminReturnRequests } from "@/app/actions/return";
import { ReturnTable } from "@/components/admin/returns/return-table";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "İade Talepleri | Admin Paneli",
    description: "İade taleplerini yönetin.",
};

export default async function AdminReturnsPage() {
    const requests = await getAdminReturnRequests();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">İade Talepleri</h1>
                    <p className="text-muted-foreground">
                        Müşterilerin oluşturduğu iade taleplerini buradan yönetebilirsiniz.
                    </p>
                </div>
            </div>

            <ReturnTable initialRequests={requests as any} />
        </div>
    );
}
