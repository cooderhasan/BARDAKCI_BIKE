import { prisma } from "@/lib/db";
import { DiscountGroupsTable } from "@/components/admin/discount-groups-table";

export default async function DiscountGroupsPage() {
    const rawGroups = await prisma.discountGroup.findMany({
        orderBy: { name: "asc" },
        include: {
            _count: {
                select: { users: true },
            },
        },
    });

    // Convert Decimal to number for client component
    const groups = rawGroups.map(group => ({
        ...group,
        discountRate: Number(group.discountRate),
    }));

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                    İskonto Grupları
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Bayi iskonto oranlarını yönetin
                </p>
            </div>

            <DiscountGroupsTable groups={groups} />
        </div>
    );
}

