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
