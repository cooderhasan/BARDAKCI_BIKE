"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";

interface BulkUpdateCriteria {
    brandId?: string;
    categoryId?: string;
    priceFilter?: "ALL" | "ZERO" | "NON_ZERO";
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
}

export async function previewBulkUpdate(
    criteria: BulkUpdateCriteria,
    params: PriceUpdateParams
): Promise<PreviewResult[]> {
    // 1. Build where clause
    const where: any = {};
    if (criteria.brandId && criteria.brandId !== "ALL") where.brandId = criteria.brandId;
    if (criteria.categoryId && criteria.categoryId !== "ALL") {
        where.categories = { some: { id: criteria.categoryId } };
    }

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
            sku: true,
        },
    });

    // 3. Calculate new prices
    return products.map((p) => {
        const oldPrice = Number(p.listPrice);
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

        return {
            id: p.id,
            name: p.name,
            oldPrice,
            newPrice: Number(newPrice.toFixed(2)),
            sku: p.sku,
        };
    });
}

export async function executeBulkUpdate(
    criteria: BulkUpdateCriteria,
    params: PriceUpdateParams
) {
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
                        data: { listPrice: item.newPrice },
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
        try {
            const { addMarketplaceSyncJob } = await import("@/lib/queue/producer");
            const productIds = preview.map(p => p.id);
            if (productIds.length > 0) {
                await Promise.all([
                    addMarketplaceSyncJob({ marketplace: "trendyol", type: "stocks", productIds }).catch(console.error),
                    addMarketplaceSyncJob({ marketplace: "n11", type: "stocks", productIds }).catch(console.error),
                    addMarketplaceSyncJob({ marketplace: "hepsiburada", type: "stocks", productIds }).catch(console.error)
                ]);
            }
        } catch (e) {
            console.error("Bulk price sync queue error:", e);
        }

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
    const where: any = {};
    if (criteria.brandId && criteria.brandId !== "ALL") where.brandId = criteria.brandId;
    if (criteria.categoryId && criteria.categoryId !== "ALL") {
        where.categories = { some: { id: criteria.categoryId } };
    }

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
        try {
            const { addMarketplaceSyncJob } = await import("@/lib/queue/producer");
            const productIds = preview.map(p => p.id);
            if (productIds.length > 0) {
                await Promise.all([
                    addMarketplaceSyncJob({ marketplace: "trendyol", type: "stocks", productIds }).catch(console.error),
                    addMarketplaceSyncJob({ marketplace: "n11", type: "stocks", productIds }).catch(console.error),
                    addMarketplaceSyncJob({ marketplace: "hepsiburada", type: "stocks", productIds }).catch(console.error)
                ]);
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

// ==================== TRENDYOL PRICE UPDATE ====================

export interface TrendyolPricePreviewResult {
    id: string;
    name: string;
    oldPrice: number;
    newPrice: number;
    sku: string | null;
    barcode: string | null;
}

export async function previewBulkTrendyolPriceUpdate(
    criteria: BulkUpdateCriteria,
    params: PriceUpdateParams
): Promise<TrendyolPricePreviewResult[]> {
    const where: any = {
        isTrendyolActive: true,
        barcode: { not: null }
    };

    if (criteria.brandId && criteria.brandId !== "ALL") where.brandId = criteria.brandId;
    if (criteria.categoryId && criteria.categoryId !== "ALL") {
        where.categories = { some: { id: criteria.categoryId } };
    }

    const products = await prisma.product.findMany({
        where,
        select: {
            id: true,
            name: true,
            trendyolPrice: true,
            listPrice: true,
            sku: true,
            barcode: true,
        },
    });

    return products.map((p) => {
        // Trendyol price defaults to listPrice if not set
        const oldPrice = p.trendyolPrice ? Number(p.trendyolPrice) : Number(p.listPrice);
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
            barcode: p.barcode
        };
    });
}

export async function executeBulkTrendyolPriceUpdate(
    criteria: BulkUpdateCriteria,
    params: PriceUpdateParams
) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    const preview = await previewBulkTrendyolPriceUpdate(criteria, params);
    const CHUNK_SIZE = 50;

    try {
        for (let i = 0; i < preview.length; i += CHUNK_SIZE) {
            const chunk = preview.slice(i, i + CHUNK_SIZE);
            await prisma.$transaction(
                chunk.map((item) =>
                    prisma.product.update({
                        where: { id: item.id },
                        data: { trendyolPrice: item.newPrice },
                    })
                )
            );
        }

        // Log the action
        await prisma.adminLog.create({
            data: {
                action: "BULK_TRENDYOL_PRICE_UPDATE",
                details: `Updated ${preview.length} products' Trendyol prices. Criteria: ${JSON.stringify(criteria)}, Params: ${JSON.stringify(params)}`,
                entityId: "BULK",
                entityType: "PRODUCT",
                adminId: session.user.id,
            }
        });

        // Add Marketplace Sync Job
        try {
            const { addMarketplaceSyncJob } = await import("@/lib/queue/producer");
            const productIds = preview.map(p => p.id);
            if (productIds.length > 0) {
                await addMarketplaceSyncJob({ 
                    marketplace: "trendyol", 
                    type: "prices", 
                    productIds 
                });
            }
        } catch (e) {
            console.error("Bulk Trendyol price sync queue error:", e);
        }

        return { success: true, count: preview.length };
    } catch (error) {
        console.error("Bulk Trendyol price update error:", error);
        throw new Error("Trendyol toplu fiyat güncelleme sırasında hata oluştu.");
    }
}
// ==================== N11 PRICE UPDATE ====================

export interface N11PricePreviewResult {
    id: string;
    name: string;
    oldPrice: number;
    newPrice: number;
    sku: string | null;
    barcode: string | null;
}

export async function previewBulkN11PriceUpdate(
    criteria: BulkUpdateCriteria,
    params: PriceUpdateParams
): Promise<N11PricePreviewResult[]> {
    const where: any = {
        isN11Active: true,
        OR: [
            { barcode: { not: null } },
            { sku: { not: null } }
        ]
    };

    if (criteria.brandId && criteria.brandId !== "ALL") where.brandId = criteria.brandId;
    if (criteria.categoryId && criteria.categoryId !== "ALL") {
        where.categories = { some: { id: criteria.categoryId } };
    }

    const products = await prisma.product.findMany({
        where,
        select: {
            id: true,
            name: true,
            n11Price: true,
            listPrice: true,
            sku: true,
            barcode: true,
        },
    });

    return products.map((p) => {
        // N11 price defaults to listPrice if not set
        const oldPrice = p.n11Price ? Number(p.n11Price) : Number(p.listPrice);
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
            barcode: p.barcode
        };
    });
}

export async function executeBulkN11PriceUpdate(
    criteria: BulkUpdateCriteria,
    params: PriceUpdateParams
) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    const preview = await previewBulkN11PriceUpdate(criteria, params);
    const CHUNK_SIZE = 50;

    try {
        for (let i = 0; i < preview.length; i += CHUNK_SIZE) {
            const chunk = preview.slice(i, i + CHUNK_SIZE);
            await prisma.$transaction(
                chunk.map((item) =>
                    prisma.product.update({
                        where: { id: item.id },
                        data: { n11Price: item.newPrice },
                    })
                )
            );
        }

        // Log the action
        await prisma.adminLog.create({
            data: {
                action: "BULK_N11_PRICE_UPDATE",
                details: `Updated ${preview.length} products' N11 prices. Criteria: ${JSON.stringify(criteria)}, Params: ${JSON.stringify(params)}`,
                entityId: "BULK",
                entityType: "PRODUCT",
                adminId: session.user.id,
            }
        });

        // Add Marketplace Sync Job
        try {
            const { addMarketplaceSyncJob } = await import("@/lib/queue/producer");
            const productIds = preview.map(p => p.id);
            if (productIds.length > 0) {
                await addMarketplaceSyncJob({ 
                    marketplace: "n11", 
                    type: "stocks", // Use stocks type for now as it handles both price/stock in N11
                    productIds 
                });
            }
        } catch (e) {
            console.error("Bulk N11 price sync queue error:", e);
        }

        return { success: true, count: preview.length };
    } catch (error) {
        console.error("Bulk N11 price update error:", error);
        throw new Error("N11 toplu fiyat güncelleme sırasında hata oluştu.");
    }
}

// ==================== HEPSIBURADA PRICE UPDATE ====================

export interface HepsiburadaPricePreviewResult {
    id: string;
    name: string;
    oldPrice: number;
    newPrice: number;
    sku: string | null;
    barcode: string | null;
}

export async function previewBulkHepsiburadaPriceUpdate(
    criteria: BulkUpdateCriteria,
    params: PriceUpdateParams
): Promise<HepsiburadaPricePreviewResult[]> {
    const where: any = {
        isHepsiburadaActive: true,
    };

    if (criteria.brandId && criteria.brandId !== "ALL") where.brandId = criteria.brandId;
    if (criteria.categoryId && criteria.categoryId !== "ALL") {
        where.categories = { some: { id: criteria.categoryId } };
    }

    const products = await prisma.product.findMany({
        where,
        select: {
            id: true,
            name: true,
            hepsiburadaPrice: true,
            listPrice: true,
            sku: true,
            barcode: true,
        },
    });

    return products.map((p) => {
        // Hepsiburada price defaults to listPrice if not set
        const oldPrice = p.hepsiburadaPrice ? Number(p.hepsiburadaPrice) : Number(p.listPrice);
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
            barcode: p.barcode
        };
    });
}

export async function executeBulkHepsiburadaPriceUpdate(
    criteria: BulkUpdateCriteria,
    params: PriceUpdateParams
) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    const preview = await previewBulkHepsiburadaPriceUpdate(criteria, params);
    const CHUNK_SIZE = 50;

    try {
        for (let i = 0; i < preview.length; i += CHUNK_SIZE) {
            const chunk = preview.slice(i, i + CHUNK_SIZE);
            await prisma.$transaction(
                chunk.map((item) =>
                    prisma.product.update({
                        where: { id: item.id },
                        data: { hepsiburadaPrice: item.newPrice },
                    })
                )
            );
        }

        // Log the action
        await prisma.adminLog.create({
            data: {
                action: "BULK_HEPSIBURADA_PRICE_UPDATE",
                details: `Updated ${preview.length} products' Hepsiburada prices. Criteria: ${JSON.stringify(criteria)}, Params: ${JSON.stringify(params)}`,
                entityId: "BULK",
                entityType: "PRODUCT",
                adminId: session.user.id,
            }
        });

        // Add Marketplace Sync Job
        try {
            const { addMarketplaceSyncJob } = await import("@/lib/queue/producer");
            const productIds = preview.map(p => p.id);
            if (productIds.length > 0) {
                await addMarketplaceSyncJob({ 
                    marketplace: "hepsiburada", 
                    type: "stocks", 
                    productIds 
                });
            }
        } catch (e) {
            console.error("Bulk Hepsiburada price sync queue error:", e);
        }

        return { success: true, count: preview.length };
    } catch (error) {
        console.error("Bulk Hepsiburada price update error:", error);
        throw new Error("Hepsiburada toplu fiyat güncelleme sırasında hata oluştu.");
    }
}

// ==================== CROSS PLATFORM PRICE TRANSFER ====================

export type PriceField = "listPrice" | "salePrice" | "trendyolPrice" | "n11Price" | "hepsiburadaPrice" | "idefixPrice";

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
    const where: any = {};

    if (criteria.brandId && criteria.brandId !== "ALL") where.brandId = criteria.brandId;
    if (criteria.categoryId && criteria.categoryId !== "ALL") {
        where.categories = { some: { id: criteria.categoryId } };
    }

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
            idefixPrice: true
        },
    });

    const results: PriceTransferPreviewResult[] = [];

    for (const p of products) {
        let sourceVal = p[criteria.sourceField] ? Number(p[criteria.sourceField]) : 0;
        
        if (!sourceVal && (criteria.sourceField === 'trendyolPrice' || criteria.sourceField === 'n11Price' || criteria.sourceField === 'hepsiburadaPrice' || criteria.sourceField === 'idefixPrice')) {
            sourceVal = Number(p.listPrice);
        }

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

        try {
            const { addMarketplaceSyncJob } = await import("@/lib/queue/producer");
            const productIds = preview.map(p => p.id);
            if (productIds.length > 0) {
                if (criteria.targetField === 'trendyolPrice') {
                    await addMarketplaceSyncJob({ marketplace: "trendyol", type: "prices", productIds }).catch(() => {});
                } else if (criteria.targetField === 'n11Price') {
                    await addMarketplaceSyncJob({ marketplace: "n11", type: "stocks", productIds }).catch(() => {});
                } else if (criteria.targetField === 'hepsiburadaPrice') {
                    await addMarketplaceSyncJob({ marketplace: "hepsiburada", type: "stocks", productIds }).catch(() => {});
                } else if (criteria.targetField === 'idefixPrice') {
                    await addMarketplaceSyncJob({ marketplace: "idefix", type: "stocks", productIds }).catch(() => {});
                }
            }
        } catch (e) {
            console.error("Bulk price transfer sync queue error:", e);
        }

        return { success: true, count: preview.length };
    } catch (error) {
        console.error("Bulk price transfer error:", error);
        throw new Error("Fiyat transferi sırasında hata oluştu.");
    }
}

