import { prisma } from "@/lib/db";
import { MarketplaceBatchList } from "@/components/admin/marketplace-batch-list";
import { syncPazaramaBatchStatuses } from "../actions";

export const dynamic = "force-dynamic";

export default async function PazaramaBatchesPage() {
    // Pazarama'da gönderim bilgisi doğrudan üründe tutuluyor
    const items = await prisma.product.findMany({
        where: { pazaramaBatchId: { not: null } },
        select: { id: true, name: true, images: true, barcode: true, pazaramaBatchId: true, pazaramaStatus: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 100,
    });

    const rows = items.map((it) => {
        const raw = it.pazaramaStatus || "";
        return {
            id: it.id,
            productName: it.name,
            image: it.images?.[0] || "",
            barcode: it.barcode || "",
            batchId: it.pazaramaBatchId || "",
            status: raw === "PENDING" || /bekliyor/i.test(raw) ? "PENDING" : /onayland/i.test(raw) ? "SUCCESS" : raw || "PENDING",
            error: raw.startsWith("Hata") ? raw : null,
            date: it.updatedAt.toISOString(),
        };
    });

    return (
        <MarketplaceBatchList
            marketplace="Pazarama"
            backHref="/admin/integrations/pazarama/products"
            rows={rows}
            onRefresh={syncPazaramaBatchStatuses}
        />
    );
}
