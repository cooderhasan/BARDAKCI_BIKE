import { prisma } from "@/lib/db";
import { MarketplaceBatchList } from "@/components/admin/marketplace-batch-list";
import { syncIdefixBatchStatuses } from "../actions";

export const dynamic = "force-dynamic";

export default async function IdefixBatchesPage() {
    const items = await (prisma as any).idefixProduct.findMany({
        where: { batchId: { not: null } },
        include: { product: { select: { name: true, images: true, barcode: true } } },
        orderBy: { lastSyncedAt: "desc" },
        take: 100,
    });

    const rows = items.map((it: any) => ({
        id: it.id,
        productName: it.product.name,
        image: it.product.images?.[0] || "",
        barcode: it.product.barcode || "",
        batchId: it.batchId,
        status: it.batchStatus || "PENDING",
        error: it.lastSyncError,
        date: it.lastSyncedAt?.toISOString() ?? null,
    }));

    return (
        <MarketplaceBatchList
            marketplace="Idefix"
            backHref="/admin/integrations/idefix/products"
            rows={rows}
            onRefresh={syncIdefixBatchStatuses}
        />
    );
}
