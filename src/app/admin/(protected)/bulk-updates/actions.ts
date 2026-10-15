"use server";
import { requireAdmin } from "@/lib/admin-guard";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";

interface BulkUpdateCriteria {
    brandId?: string;
    categoryId?: string;
    /** Birden fazla kategori (önceden seçicide çoklu seçilse de sadece ilki uygulanıyordu) */
    categoryIds?: string[];
    priceFilter?: "ALL" | "ZERO" | "NON_ZERO";
    /** Mağaza: BIKE / MOTOR / BOTH (ortak) birebir eşleşir; ALL ya da boş = hepsi */
    store?: "ALL" | "BIKE" | "MOTOR" | "BOTH";
}

/** Tüm toplu işlemlerde ortak filtre: marka, kategori(ler), mağaza */
function buildBaseWhere(criteria: BulkUpdateCriteria): any {
    // Kategori açıkça seçilmeli: belirli kategoriler ya da "ALL". Boş gelirse yanlışlıkla tüm ürünler etkilenmesin.
    const hasCategory = (criteria.categoryIds && criteria.categoryIds.length > 0) || !!criteria.categoryId;
    if (!hasCategory) throw new Error("Kategori seçilmedi. Kategori seçin ya da 'Tüm Kategoriler'i açın.");
    const where: any = {};
    if (criteria.brandId && criteria.brandId !== "ALL") where.brandId = criteria.brandId;
    if (criteria.categoryIds && criteria.categoryIds.length > 0) {
        where.categories = { some: { id: { in: criteria.categoryIds } } };
    } else if (criteria.categoryId && criteria.categoryId !== "ALL") {
        where.categories = { some: { id: criteria.categoryId } };
    }
    if (criteria.store && criteria.store !== "ALL") where.store = criteria.store;
    return where;
}

const ALL_MARKETPLACES = ["trendyol", "n11", "hepsiburada", "idefix", "pazarama", "pttavm", "ciceksepeti"] as const;

/**
 * Fiyat değişikliğini pazaryerlerine gönderir. Her iş fiyat + stok (stok - kritik stok) gönderir;
 * pazaryerinde aktif olmayan ürünler senkron fonksiyonlarında zaten atlanır.
 */
async function enqueuePriceSync(productIds: string[], marketplaces: readonly string[] = ALL_MARKETPLACES) {
    if (productIds.length === 0) return;
    try {
        const { addMarketplaceSyncJob } = await import("@/lib/queue/producer");
        await Promise.all(
            marketplaces.map((m) =>
                addMarketplaceSyncJob({ marketplace: m as any, type: m === "trendyol" || m === "ciceksepeti" ? "prices" : "stocks", productIds }).catch(console.error)
            )
        );
    } catch (e) {
        console.error("Toplu fiyat senkron kuyruğu hatası:", e);
    }
}

interface PriceUpdateParams {
    operation: "INCREASE" | "DECREASE";
    type: "PERCENTAGE" | "FIXED_AMOUNT";
    value: number;
}

export interface PreviewResult {
    id: string;
    name: string;
    oldPrice: number;
    newPrice: number;
    sku: string | null;
    oldSalePrice?: number | null;
    newSalePrice?: number | null;
}

export async function previewBulkUpdate(
    criteria: BulkUpdateCriteria,
    params: PriceUpdateParams
): Promise<PreviewResult[]> {
    await requireAdmin();
    // 1. Build where clause
    const where: any = buildBaseWhere(criteria);

    // Filter by Price Status
    if (criteria.priceFilter === "ZERO") {
        where.listPrice = { equals: 0 };
    } else if (criteria.priceFilter === "NON_ZERO") {
        where.listPrice = { gt: 0 };
    }

    // 2. Fetch products
    const products = await prisma.product.findMany({
        where,
        select: {
            id: true,
            name: true,
            listPrice: true,
            salePrice: true,
            sku: true,
        },
    });

    const apply = (oldPrice: number) => {
        let newPrice = oldPrice;
        if (params.type === "PERCENTAGE") {
            const amount = oldPrice * (params.value / 100);
            newPrice = params.operation === "INCREASE" ? oldPrice + amount : oldPrice - amount;
        } else {
            // FIXED_AMOUNT
            newPrice = params.operation === "INCREASE" ? oldPrice + params.value : oldPrice - params.value;
        }
        // Ensure no negative prices
        if (newPrice < 0) newPrice = 0;
        return Number(newPrice.toFixed(2));
    };

    // 3. Calculate new prices
    return products.map((p) => {
        const oldPrice = Number(p.listPrice);
        const oldSale = p.salePrice != null ? Number(p.salePrice) : 0;
        return {
            id: p.id,
            name: p.name,
            oldPrice,
            newPrice: apply(oldPrice),
            sku: p.sku,
            // İndirimli fiyatı olan üründe indirimli fiyat da aynı işlemle güncellenir
            // (önceden sadece liste fiyatı değişiyor, site eski indirimli fiyattan satmaya devam ediyordu)
            oldSalePrice: oldSale > 0 ? oldSale : null,
            newSalePrice: oldSale > 0 ? apply(oldSale) : null,
        };
    });
}

export async function executeBulkUpdate(
    criteria: BulkUpdateCriteria,
    params: PriceUpdateParams
) {
    await requireAdmin();
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    const preview = await previewBulkUpdate(criteria, params);

    // Batch transactions might be too big. Let's do it in chunks of 50.
    const CHUNK_SIZE = 50;

    try {
        for (let i = 0; i < preview.length; i += CHUNK_SIZE) {
            const chunk = preview.slice(i, i + CHUNK_SIZE);

            await prisma.$transaction(
                chunk.map((item) =>
                    prisma.product.update({
                        where: { id: item.id },
                        data: {
                            listPrice: item.newPrice,
                            ...(item.newSalePrice != null ? { salePrice: item.newSalePrice } : {}),
                        },
                    })
                )
            );
        }

        // Log the action
        await prisma.adminLog.create({
            data: {
                action: "BULK_PRICE_UPDATE",
                details: `Updated ${preview.length} products. Criteria: ${JSON.stringify(criteria)}, Params: ${JSON.stringify(params)}`,
                entityId: "BULK",
                entityType: "PRODUCT",
                adminId: session.user.id,
            }
        });

        revalidatePath("/admin/products");
        revalidatePath("/");

        // --- OTOMATİK PAZARYERİ SENKRONİZASYONU ---
        // Kendi fiyatı girilmemiş pazaryerleri liste fiyatını kullandığı için 7 pazaryerinin hepsine gönderilir
        // (önceden sadece Trendyol/N11/HB'ye gidiyordu)
        await enqueuePriceSync(preview.map(p => p.id));

        return { success: true, count: preview.length };
    } catch (error) {
        console.error("Bulk update error:", error);
        throw new Error("Toplu güncelleme sırasında hata oluştu.");
    }
}

interface StockUpdateParams {
    operation: "SET" | "INCREASE" | "DECREASE";
    value: number;
}

export interface StockPreviewResult {
    id: string;
    name: string;
    oldStock: number;
    newStock: number;
    sku: string | null;
}

export async function previewBulkStockUpdate(
    criteria: BulkUpdateCriteria,
    params: StockUpdateParams
): Promise<StockPreviewResult[]> {
    await requireAdmin();
    // Paket ürünlerin stoğu içeriğinden hesaplanır; toplu stok onlara yazılmaz
    const where: any = { ...buildBaseWhere(criteria), isBundle: false };

    // Note: ignoring priceFilter for stock updates unless requested.

    const products = await prisma.product.findMany({
        where,
        select: {
            id: true,
            name: true,
            stock: true,
            sku: true,
        },
    });

    return products.map((p) => {
        const oldStock = p.stock;
        let newStock = oldStock;

        if (params.operation === "SET") {
            newStock = params.value;
        } else if (params.operation === "INCREASE") {
            newStock = oldStock + params.value;
        } else if (params.operation === "DECREASE") {
            newStock = oldStock - params.value;
        }

        if (newStock < 0) newStock = 0;

        return {
            id: p.id,
            name: p.name,
            oldStock,
            newStock,
            sku: p.sku,
        };
    });
}

export async function executeBulkStockUpdate(
    criteria: BulkUpdateCriteria,
    params: StockUpdateParams
) {
    await requireAdmin();
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    const preview = await previewBulkStockUpdate(criteria, params);
    const CHUNK_SIZE = 50;

    try {
        for (let i = 0; i < preview.length; i += CHUNK_SIZE) {
            const chunk = preview.slice(i, i + CHUNK_SIZE);
            await prisma.$transaction(
                chunk.map((item) =>
                    prisma.product.update({
                        where: { id: item.id },
                        data: { stock: item.newStock },
                    })
                )
            );
        }

        await prisma.adminLog.create({
            data: {
                action: "BULK_STOCK_UPDATE",
                details: `Updated ${preview.length} products. Criteria: ${JSON.stringify(criteria)}, Params: ${JSON.stringify(params)}`,
                entityId: "BULK",
                entityType: "PRODUCT",
                adminId: session.user.id,
            }
        });

        revalidatePath("/admin/products");
        revalidatePath("/");

        // --- OTOMATİK PAZARYERİ SENKRONİZASYONU ---
        // Sipariş sonrası stok senkronuyla aynı yol: 7 pazaryeri + kritik stok kuralı.
        // İçinde bu ürünler olan paketlerin stoğu da yeniden hesaplanıp gönderilir.
        try {
            const productIds = preview.map(p => p.id);
            if (productIds.length > 0) {
                const { recalcBundleStocks, handlePostOrderStockSync } = await import("@/lib/stock-sync");
                const bundleIds = await recalcBundleStocks(prisma, productIds);
                await handlePostOrderStockSync(Array.from(new Set([...productIds, ...bundleIds])), "site");
            }
        } catch (e) {
            console.error("Bulk stock sync queue error:", e);
        }

        return { success: true, count: preview.length };
    } catch (error) {
        console.error("Bulk stock update error:", error);
        throw new Error("Toplu stok güncelleme sırasında hata oluştu.");
    }
}

// ==================== PAZARYERİ FİYATLARI (7 pazaryeri tek yerden) ====================
// Önceden sadece Trendyol / N11 / HB için ayrı ayrı vardı; Idefix, Pazarama, ePttAVM, Çiçeksepeti yoktu.

export type MarketplaceKey = "trendyol" | "n11" | "hepsiburada" | "idefix" | "pazarama" | "pttavm" | "ciceksepeti";

const MARKETPLACE_PRICE_CONFIG: Record<MarketplaceKey, { priceField: string; activeField: string; label: string; extraWhere?: any }> = {
    trendyol: { priceField: "trendyolPrice", activeField: "isTrendyolActive", label: "Trendyol", extraWhere: { barcode: { not: null } } },
    n11: { priceField: "n11Price", activeField: "isN11Active", label: "N11", extraWhere: { OR: [{ barcode: { not: null } }, { sku: { not: null } }] } },
    hepsiburada: { priceField: "hepsiburadaPrice", activeField: "isHepsiburadaActive", label: "Hepsiburada" },
    idefix: { priceField: "idefixPrice", activeField: "isIdefixActive", label: "Idefix" },
    pazarama: { priceField: "pazaramaPrice", activeField: "isPazaramaActive", label: "Pazarama" },
    pttavm: { priceField: "pttavmPrice", activeField: "isPttavmActive", label: "ePttAVM" },
    ciceksepeti: { priceField: "ciceksepetiPrice", activeField: "isCiceksepetiActive", label: "Çiçeksepeti" },
};

export interface MarketplacePricePreviewResult {
    id: string;
    name: string;
    oldPrice: number;
    newPrice: number;
    sku: string | null;
    barcode: string | null;
    /** Pazaryeri fiyatı girilmemişti; mevcut fiyat olarak liste fiyatı kullanıldı */
    fromListPrice: boolean;
}

export async function previewBulkMarketplacePriceUpdate(
    marketplace: MarketplaceKey,
    criteria: BulkUpdateCriteria,
    params: PriceUpdateParams
): Promise<MarketplacePricePreviewResult[]> {
    await requireAdmin();
    const cfg = MARKETPLACE_PRICE_CONFIG[marketplace];
    if (!cfg) throw new Error("Geçersiz pazaryeri.");

    // Sadece o pazaryerinde aktif ürünler
    const where: any = { ...buildBaseWhere(criteria), [cfg.activeField]: true, ...(cfg.extraWhere || {}) };

    const products: any[] = await prisma.product.findMany({
        where,
        select: { id: true, name: true, sku: true, barcode: true, listPrice: true, [cfg.priceField]: true } as any,
    });

    return products.map((p) => {
        const own = p[cfg.priceField] != null ? Number(p[cfg.priceField]) : 0;
        // Pazaryeri fiyatı boşsa o pazaryerine zaten liste fiyatı gidiyor; hesap ondan yapılır
        const oldPrice = own > 0 ? own : Number(p.listPrice);
        let newPrice = oldPrice;
        if (params.type === "PERCENTAGE") {
            const amount = oldPrice * (params.value / 100);
            newPrice = params.operation === "INCREASE" ? oldPrice + amount : oldPrice - amount;
        } else {
            newPrice = params.operation === "INCREASE" ? oldPrice + params.value : oldPrice - params.value;
        }
        if (newPrice < 0) newPrice = 0;
        return {
            id: p.id,
            name: p.name,
            oldPrice,
            newPrice: Number(newPrice.toFixed(2)),
            sku: p.sku,
            barcode: p.barcode,
            fromListPrice: !(own > 0),
        };
    });
}

export async function executeBulkMarketplacePriceUpdate(
    marketplace: MarketplaceKey,
    criteria: BulkUpdateCriteria,
    params: PriceUpdateParams
) {
    await requireAdmin();
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }
    const cfg = MARKETPLACE_PRICE_CONFIG[marketplace];
    if (!cfg) throw new Error("Geçersiz pazaryeri.");

    const preview = await previewBulkMarketplacePriceUpdate(marketplace, criteria, params);
    const CHUNK_SIZE = 50;

    try {
        for (let i = 0; i < preview.length; i += CHUNK_SIZE) {
            const chunk = preview.slice(i, i + CHUNK_SIZE);
            await prisma.$transaction(
                chunk.map((item) =>
                    prisma.product.update({
                        where: { id: item.id },
                        data: { [cfg.priceField]: item.newPrice } as any,
                    })
                )
            );
        }

        await prisma.adminLog.create({
            data: {
                action: `BULK_${marketplace.toUpperCase()}_PRICE_UPDATE`,
                details: `Updated ${preview.length} products' ${cfg.label} prices. Criteria: ${JSON.stringify(criteria)}, Params: ${JSON.stringify(params)}`,
                entityId: "BULK",
                entityType: "PRODUCT",
                adminId: session.user.id,
            }
        });

        // Sadece bu pazaryerine gönderilir
        await enqueuePriceSync(preview.map(p => p.id), [marketplace]);

        return { success: true, count: preview.length };
    } catch (error) {
        console.error(`Bulk ${cfg.label} price update error:`, error);
        throw new Error(`${cfg.label} toplu fiyat güncelleme sırasında hata oluştu.`);
    }
}

// ==================== CROSS PLATFORM PRICE TRANSFER ====================

export type PriceField = "listPrice" | "salePrice" | "trendyolPrice" | "n11Price" | "hepsiburadaPrice" | "idefixPrice" | "pazaramaPrice" | "pttavmPrice" | "ciceksepetiPrice";

export interface PriceTransferCriteria extends BulkUpdateCriteria {
    sourceField: PriceField;
    targetField: PriceField;
    onlyEmptyTarget: boolean;
}

export interface PriceTransferParams {
    operation: "INCREASE_PERCENTAGE" | "DECREASE_PERCENTAGE" | "INCREASE_FIXED" | "DECREASE_FIXED" | "MULTIPLY" | "COPY";
    value: number;
}

export interface PriceTransferPreviewResult {
    id: string;
    name: string;
    sourcePrice: number;
    oldTargetPrice: number;
    newTargetPrice: number;
    sku: string | null;
    barcode: string | null;
}

export async function previewBulkPriceTransfer(
    criteria: PriceTransferCriteria,
    params: PriceTransferParams
): Promise<PriceTransferPreviewResult[]> {
    await requireAdmin();
    const where: any = buildBaseWhere(criteria);

    const products = await prisma.product.findMany({
        where,
        select: {
            id: true,
            name: true,
            sku: true,
            barcode: true,
            listPrice: true,
            salePrice: true,
            trendyolPrice: true,
            n11Price: true,
            hepsiburadaPrice: true,
            idefixPrice: true,
            // Önceden bu üçü okunmuyordu: kaynak seçilince hedefler 0'a yazılıyor, hedef seçilince dolu fiyatlar eziliyordu
            pazaramaPrice: true,
            pttavmPrice: true,
            ciceksepetiPrice: true,
        },
    });

    const results: PriceTransferPreviewResult[] = [];

    const marketplaceFields: PriceField[] = ["trendyolPrice", "n11Price", "hepsiburadaPrice", "idefixPrice", "pazaramaPrice", "pttavmPrice", "ciceksepetiPrice"];

    for (const p of products as any[]) {
        let sourceVal = p[criteria.sourceField] ? Number(p[criteria.sourceField]) : 0;

        // Pazaryeri fiyatı boşsa o pazaryerine zaten liste fiyatı gidiyor; kaynak olarak da onu kullan
        if (!sourceVal && marketplaceFields.includes(criteria.sourceField)) {
            sourceVal = Number(p.listPrice);
        }

        // Kaynak fiyatı yoksa (ör. indirimli fiyatı olmayan ürün) atla; önceden hedef 0'a yazılıyordu
        if (!sourceVal || sourceVal <= 0) continue;

        let targetVal = p[criteria.targetField] ? Number(p[criteria.targetField]) : 0;

        if (criteria.onlyEmptyTarget && targetVal > 0) {
            continue;
        }

        let newTargetPrice = sourceVal;

        switch (params.operation) {
            case "INCREASE_PERCENTAGE":
                newTargetPrice = sourceVal + (sourceVal * (params.value / 100));
                break;
            case "DECREASE_PERCENTAGE":
                newTargetPrice = sourceVal - (sourceVal * (params.value / 100));
                break;
            case "INCREASE_FIXED":
                newTargetPrice = sourceVal + params.value;
                break;
            case "DECREASE_FIXED":
                newTargetPrice = sourceVal - params.value;
                break;
            case "MULTIPLY":
                newTargetPrice = sourceVal * params.value;
                break;
            case "COPY":
                newTargetPrice = sourceVal;
                break;
        }

        if (newTargetPrice < 0) newTargetPrice = 0;
        newTargetPrice = Number(newTargetPrice.toFixed(2));

        if (newTargetPrice !== targetVal) {
            results.push({
                id: p.id,
                name: p.name,
                sourcePrice: sourceVal,
                oldTargetPrice: targetVal,
                newTargetPrice: newTargetPrice,
                sku: p.sku,
                barcode: p.barcode,
            });
        }
    }

    return results;
}

export async function executeBulkPriceTransfer(
    criteria: PriceTransferCriteria,
    params: PriceTransferParams
) {
    await requireAdmin();
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    const preview = await previewBulkPriceTransfer(criteria, params);
    const CHUNK_SIZE = 50;

    try {
        for (let i = 0; i < preview.length; i += CHUNK_SIZE) {
            const chunk = preview.slice(i, i + CHUNK_SIZE);
            await prisma.$transaction(
                chunk.map((item) =>
                    prisma.product.update({
                        where: { id: item.id },
                        data: { [criteria.targetField]: item.newTargetPrice },
                    })
                )
            );
        }

        await prisma.adminLog.create({
            data: {
                action: "BULK_PRICE_TRANSFER",
                details: `Transferred prices from ${criteria.sourceField} to ${criteria.targetField} for ${preview.length} products. Params: ${JSON.stringify(params)}`,
                entityId: "BULK",
                entityType: "PRODUCT",
                adminId: session.user.id,
            }
        });

        // Hedef pazaryeri fiyatıysa o pazaryerine; liste/indirimli fiyatsa (diğerleri onu kullandığı için) hepsine gönder
        const fieldToMarketplace: Record<string, string> = {
            trendyolPrice: "trendyol", n11Price: "n11", hepsiburadaPrice: "hepsiburada", idefixPrice: "idefix",
            pazaramaPrice: "pazarama", pttavmPrice: "pttavm", ciceksepetiPrice: "ciceksepeti",
        };
        const target = fieldToMarketplace[criteria.targetField];
        await enqueuePriceSync(preview.map(p => p.id), target ? [target] : ALL_MARKETPLACES);

        return { success: true, count: preview.length };
    } catch (error) {
        console.error("Bulk price transfer error:", error);
        throw new Error("Fiyat transferi sırasında hata oluştu.");
    }
}

