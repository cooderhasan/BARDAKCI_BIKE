import { prisma } from "@/lib/db";
import { MarketplaceBatchList } from "@/components/admin/marketplace-batch-list";
import { syncCiceksepetiBatchStatuses } from "../actions";

export const dynamic = "force-dynamic";

export default async function CiceksepetiBatchesPage() {
    const items = await (prisma as any).ciceksepetiProduct.findMany({
        where: { AND: [{ batchRequestId: { not: null } }, { batchRequestId: { not: "SUCCESS" } }] },
        include: { product: { select: { name: true, images: true, barcode: true } } },
        orderBy: { lastSyncedAt: "desc" },
        take: 100,
    });

    const rows = items.map((it: any) => ({
        id: it.id,
        productName: it.product.name,
        image: it.product.images?.[0] || "",
        barcode: it.product.barcode || "",
        batchId: it.batchRequestId,
        status: it.batchStatus || "PENDING",
        error: it.lastSyncError,
        date: it.lastSyncedAt?.toISOString() ?? null,
    }));

    return (
        <MarketplaceBatchList
            marketplace="Çiçeksepeti"
            backHref="/admin/integrations/ciceksepeti/products"
            rows={rows}
            onRefresh={syncCiceksepetiBatchStatuses}
        />
    );
}
