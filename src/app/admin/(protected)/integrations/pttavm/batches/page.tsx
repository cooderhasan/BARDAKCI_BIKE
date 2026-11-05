import { prisma } from "@/lib/db";
import { MarketplaceBatchList } from "@/components/admin/marketplace-batch-list";

export const dynamic = "force-dynamic";

export default async function PttavmBatchesPage() {
    const items = await (prisma as any).pttavmProduct.findMany({
        where: { trackingId: { not: null } },
        include: { product: { select: { name: true, images: true, barcode: true } } },
        orderBy: { lastSyncedAt: "desc" },
        take: 100,
    });

    const rows = items.map((it: any) => ({
        id: it.id,
        productName: it.product.name,
        image: it.product.images?.[0] || "",
        barcode: it.product.barcode || "",
        batchId: it.trackingId,
        status: it.batchStatus || "PENDING",
        error: it.lastSyncError,
        date: it.lastSyncedAt?.toISOString() ?? null,
    }));

    return (
        <MarketplaceBatchList
            marketplace="ePttAVM"
            backHref="/admin/integrations/pttavm/products"
            rows={rows}
        />
    );
}
