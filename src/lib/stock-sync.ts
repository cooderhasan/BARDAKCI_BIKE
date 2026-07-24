/**
 * Kritik Stok Otomatik Sıfırlama Modülü
 * 
 * Herhangi bir kaynaktan sipariş geldiğinde (site, Trendyol, N11, HB),
 * stok düştükten sonra bu modül çağrılır. Eğer ürünün stoku kritik seviyeye
 * ulaşmış veya altına düşmüşse, TÜM pazaryerlerine anında stok=0 gönderir.
 * 
 * Bu sayede kuyruk gecikmesi beklenmeden pazaryerlerinde satış durdurulur.
 */

import { prisma } from "@/lib/db";
import { getSiteSettings } from "@/app/admin/(protected)/settings/actions";

interface StockCheckResult {
    productId: string;
    productName: string;
    currentStock: number;
    criticalStock: number;
    isCritical: boolean;
}

/**
 * Verilen ürün ID'leri için stok durumunu kontrol eder.
 * Kritik seviyeye ulaşmış ürünleri döner.
 */
export async function checkCriticalStockLevels(productIds: string[]): Promise<StockCheckResult[]> {
    if (productIds.length === 0) return [];

    const generalSettings = await getSiteSettings("general");
    const defaultCritical = Number((generalSettings as any)?.defaultCriticalStock || 10);

    const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
            id: true,
            name: true,
            stock: true,
            criticalStock: true,
            barcode: true,
        },
    });

    return products.map((p) => {
        const criticalStock = p.criticalStock ?? defaultCritical;
        return {
            productId: p.id,
            productName: p.name,
            currentStock: p.stock,
            criticalStock,
            isCritical: p.stock <= criticalStock,
        };
    });
}

/**
 * Kritik stoka ulaşmış ürünler için TÜM pazaryerlerine acil stok=0 gönderir.
 * Kuyruk (BullMQ) beklenmeden doğrudan API çağrısı yapar.
 * 
 * Bu fonksiyon fire-and-forget olarak çağrılmalıdır (.catch(console.error))
 */
export async function pushZeroStockToAllMarketplaces(productIds: string[]): Promise<void> {
    if (productIds.length === 0) return;

    console.log(`🚨 [Kritik Stok] ${productIds.length} ürün için acil stok=0 gönderimi başlatılıyor...`);

    // Her pazaryeri için paralel olarak stok=0 gönder
    const results = await Promise.allSettled([
        pushZeroStockToTrendyol(productIds),
        pushZeroStockToN11(productIds),
        pushZeroStockToHepsiburada(productIds),
        pushZeroStockToPazarama(productIds),
        pushZeroStockToIdefix(productIds),
    ]);

    for (const [index, result] of results.entries()) {
        const marketplaces = ["Trendyol", "N11", "Hepsiburada", "Pazarama", "Idefix"];
        if (result.status === "fulfilled") {
            console.log(`✅ [Kritik Stok] ${marketplaces[index]} stok=0 gönderildi`);
        } else {
            console.error(`❌ [Kritik Stok] ${marketplaces[index]} hatası:`, result.reason?.message || result.reason);
        }
    }
}

/**
 * Sipariş geldiğinde çağrılacak ana fonksiyon.
 * 1. Etkilenen ürünlerin stok seviyesini kontrol eder
 * 2. Kritik seviyeye ulaşmış ürünler için acil stok=0 gönderir
 * 3. Kritik olmayan ürünler için normal kuyruk sync'i tetikler
 */
export async function handlePostOrderStockSync(
    affectedProductIds: string[],
    sourceMarketplace?: "trendyol" | "n11" | "hepsiburada" | "site"
): Promise<void> {
    if (affectedProductIds.length === 0) return;

    try {
        // 1. Kritik stok kontrolü
        const stockResults = await checkCriticalStockLevels(affectedProductIds);
        const criticalProducts = stockResults.filter((r) => r.isCritical);
        const normalProducts = stockResults.filter((r) => !r.isCritical);

        // 2. Kritik ürünler için ACIL stok=0 gönder (kuyruk BEKLENMEZ)
        if (criticalProducts.length > 0) {
            const criticalIds = criticalProducts.map((p) => p.productId);
            console.log(
                `🚨 [Kritik Stok] ${criticalProducts.length} ürün kritik seviyede:`,
                criticalProducts.map((p) => `${p.productName} (stok: ${p.currentStock}, kritik: ${p.criticalStock})`).join(", ")
            );

            // Fire and forget - doğrudan API çağrısı
            pushZeroStockToAllMarketplaces(criticalIds).catch(console.error);
        }

        // 3. Normal ürünler için kuyruk üzerinden sync (TÜM pazaryerleri dahil, kaynak platform DAHİL)
        if (normalProducts.length > 0) {
            const normalIds = normalProducts.map((p) => p.productId);
            const { addMarketplaceSyncJob } = await import("@/lib/queue/producer");

            // Tüm pazaryerlerine sync at (kaynak platform DAHİL - bu eskiden eksikti!)
            await Promise.all([
                addMarketplaceSyncJob({ marketplace: "trendyol", type: "stocks", productIds: normalIds }).catch(console.error),
                addMarketplaceSyncJob({ marketplace: "n11", type: "stocks", productIds: normalIds }).catch(console.error),
                addMarketplaceSyncJob({ marketplace: "hepsiburada", type: "stocks", productIds: normalIds }).catch(console.error),
                addMarketplaceSyncJob({ marketplace: "pazarama", type: "stocks", productIds: normalIds }).catch(console.error),
                addMarketplaceSyncJob({ marketplace: "idefix", type: "stocks", productIds: normalIds }).catch(console.error),
            ]);
        }
    } catch (error) {
        console.error("❌ [PostOrder StockSync] Hata:", error);
        // Hata olsa bile kuyruk yedek olarak çalışsın
        try {
            const { addMarketplaceSyncJob } = await import("@/lib/queue/producer");
            await Promise.all([
                addMarketplaceSyncJob({ marketplace: "trendyol", type: "stocks", productIds: affectedProductIds }).catch(console.error),
                addMarketplaceSyncJob({ marketplace: "n11", type: "stocks", productIds: affectedProductIds }).catch(console.error),
                addMarketplaceSyncJob({ marketplace: "hepsiburada", type: "stocks", productIds: affectedProductIds }).catch(console.error),
                addMarketplaceSyncJob({ marketplace: "pazarama", type: "stocks", productIds: affectedProductIds }).catch(console.error),
                addMarketplaceSyncJob({ marketplace: "idefix", type: "stocks", productIds: affectedProductIds }).catch(console.error),
            ]);
        } catch (e) {
            console.error("❌ [PostOrder StockSync] Yedek kuyruk da başarısız:", e);
        }
    }
}

// ======================== MARKETPLACE-SPECIFIC PUSH ========================

/**
 * Trendyol'a doğrudan stok=0 gönderir
 */
async function pushZeroStockToTrendyol(productIds: string[]): Promise<void> {
    const config = await (prisma as any).trendyolConfig.findFirst({ where: { isActive: true } });
    if (!config) return;

    const { TrendyolClient } = await import("@/services/trendyol/api");
    const client = new TrendyolClient({
        supplierId: config.supplierId,
        apiKey: config.apiKey,
        apiSecret: config.apiSecret,
    });

    // Ürünlerin barkodlarını çek (varyantlar dahil)
    const products = await prisma.product.findMany({
        where: {
            id: { in: productIds },
            isActive: true,
            isTrendyolActive: true,
        },
        select: { id: true, barcode: true, variants: { select: { barcode: true } } },
    });

    const items: { barcode: string; quantity: number }[] = [];

    for (const p of products) {
        if (p.variants && p.variants.length > 0) {
            for (const v of p.variants) {
                if (v.barcode) {
                    items.push({ barcode: v.barcode, quantity: 0 });
                }
            }
        } else if (p.barcode) {
            items.push({ barcode: p.barcode, quantity: 0 });
        }
    }

    if (items.length === 0) return;

    const result = await client.updatePriceAndInventory(items);
    if (!result.ok) {
        throw new Error(`Trendyol stok=0 hatası: ${result.message || "Bilinmeyen"}`);
    }
}

/**
 * N11'e doğrudan stok=0 gönderir
 */
async function pushZeroStockToN11(productIds: string[]): Promise<void> {
    const config = await (prisma as any).n11Config.findFirst({ where: { isActive: true } });
    if (!config) return;

    const { N11Client } = await import("@/services/n11/api");
    const client = new N11Client({
        apiKey: config.apiKey,
        apiSecret: config.apiSecret,
    });

    const products = await prisma.product.findMany({
        where: {
            id: { in: productIds },
            isActive: true,
            isN11Active: true,
        },
        select: { id: true, sku: true, barcode: true, variants: { select: { sku: true, barcode: true } } },
    });

    const items: { stockCode: string; quantity: number }[] = [];

    for (const p of products) {
        if (p.variants && p.variants.length > 0) {
            for (const v of p.variants) {
                const stockCode = v.sku || v.barcode;
                if (stockCode) {
                    items.push({ stockCode, quantity: 0 });
                }
            }
        } else {
            const stockCode = p.sku || p.barcode;
            if (stockCode) {
                items.push({ stockCode, quantity: 0 });
            }
        }
    }

    if (items.length === 0) return;

    // N11 updateStockAndPrice her item için quantity=0 gönder
    const syncItems = items.map((i) => ({
        stockCode: i.stockCode,
        quantity: 0,
        salePrice: 0, // N11 API price required, 0 = don't change
        listPrice: 0,
        currencyType: "TL" as const,
    }));

    await client.updateStockAndPrice(syncItems);
}

/**
 * Hepsiburada'ya doğrudan stok=0 gönderir
 */
async function pushZeroStockToHepsiburada(productIds: string[]): Promise<void> {
    const config = await (prisma as any).hepsiburadaConfig.findFirst({ where: { isActive: true } });
    if (!config) return;

    const { HepsiburadaClient } = await import("@/services/hepsiburada/api");
    const client = new HepsiburadaClient({
        username: config.username,
        password: config.password,
        merchantId: config.merchantId || config.username,
        isTestMode: config.isTestMode ?? false,
    });

    const products = await prisma.product.findMany({
        where: {
            id: { in: productIds },
            isActive: true,
        },
        include: { variants: true, hepsiburadaProduct: true },
    });

    // HB SKU eşleşmesi için listing'leri çekmemiz lazım
    let hbSkuMap: Record<string, string> = {};
    try {
        let offset = 0;
        const limit = 100;
        let hasMore = true;
        while (hasMore) {
            const res = await client.getListings(limit, offset);
            const arr = res?.listings || res?.items || (Array.isArray(res) ? res : []);
            if (arr.length === 0) {
                hasMore = false;
            } else {
                for (const l of arr) {
                    if (l.merchantSku && l.hepsiburadaSku) {
                        hbSkuMap[l.merchantSku] = l.hepsiburadaSku;
                    }
                }
                if (arr.length < limit) hasMore = false;
                else offset += limit;
            }
        }
    } catch (e: any) {
        console.error("[Kritik Stok HB] Listing çekilemedi:", e.message);
        return;
    }

    const hbItems: any[] = [];

    for (const p of products) {
        const hbMerchantSku = (p as any).hepsiburadaProduct?.merchantSku || p.sku || p.barcode || "";

        if (p.variants && p.variants.length > 0) {
            for (const v of p.variants) {
                const merchantSku = v.sku || v.barcode;
                if (!merchantSku) continue;
                const hepsiburadaSku = hbSkuMap[merchantSku] || hbSkuMap[hbMerchantSku] || (p as any).hepsiburadaProduct?.hbSku;
                if (!hepsiburadaSku) continue;

                hbItems.push({
                    hepsiburadaSku,
                    merchantSku,
                    availableStock: 0,
                    price: Number(p.listPrice),
                    dispatchTime: 1,
                    cargoCompany1: "Yurtiçi Kargo",
                    maximumPurchasableQuantity: 0,
                });
            }
        } else {
            const merchantSku = hbMerchantSku;
            const hepsiburadaSku = hbSkuMap[merchantSku] || (p as any).hepsiburadaProduct?.hbSku;
            if (!hepsiburadaSku) continue;

            hbItems.push({
                hepsiburadaSku,
                merchantSku,
                availableStock: 0,
                price: Number(p.listPrice),
                dispatchTime: 1,
                cargoCompany1: "Yurtiçi Kargo",
                maximumPurchasableQuantity: 0,
            });
        }
    }

    if (hbItems.length === 0) return;

    await client.uploadInventory(hbItems);
}

/**
 * Pazarama'ya doğrudan stok=0 gönderir
 */
async function pushZeroStockToPazarama(productIds: string[]): Promise<void> {
    const config = await (prisma as any).pazaramaConfig.findFirst({ where: { isActive: true } });
    if (!config) return;

    const { PazaramaClient } = await import("@/services/pazarama/api");
    const client = new PazaramaClient(config);

    const products = await prisma.product.findMany({
        where: {
            id: { in: productIds },
            isActive: true,
            isPazaramaActive: true,
        },
        select: { id: true, barcode: true, sku: true, salePrice: true, listPrice: true, pazaramaPrice: true },
    });

    if (products.length === 0) return;

    const profitMargin = config.profitMargin || 0;
    const items = products.map((p) => {
        const basePrice = Number(p.pazaramaPrice || p.salePrice || p.listPrice);
        const finalPrice = profitMargin > 0 ? basePrice * (1 + profitMargin / 100) : basePrice;
        return {
            code: p.barcode || p.sku || p.id,
            stock: 0,
            price: Math.round(finalPrice * 100) / 100,
        };
    });

    const result = await client.updateStockAndPrice(items);
    if (!result.success) {
        throw new Error(`Pazarama stok=0 hatası: ${result.message || "Bilinmeyen"}`);
    }
}

/**
 * Idefix'e doğrudan stok=0 gönderir
 */
async function pushZeroStockToIdefix(productIds: string[]): Promise<void> {
    const config = await (prisma as any).idefixConfig.findFirst({ where: { isActive: true } });
    if (!config) return;

    const { IdefixClient } = await import("@/services/idefix/api");
    const client = new IdefixClient({
        apiKey: config.apiKey,
        apiSecret: config.apiSecret,
        vendorId: config.vendorId,
        isTestMode: Boolean(config.isTestMode),
    });

    const products = await prisma.product.findMany({
        where: {
            id: { in: productIds },
            isActive: true,
            isIdefixActive: true,
        },
        select: { id: true, barcode: true, sku: true, salePrice: true, listPrice: true, idefixPrice: true, variants: { select: { barcode: true, stock: true } } },
    });

    if (products.length === 0) return;

    const items: any[] = [];
    for (const p of products) {
        const price = Number(p.idefixPrice ?? p.salePrice ?? p.listPrice);
        const comparePrice = Number(p.listPrice) >= price ? Number(p.listPrice) : price;
        const validVariants = p.variants?.filter((v: any) => v.barcode) || [];
        if (validVariants.length > 0) {
            for (const v of validVariants) {
                items.push({
                    barcode: v.barcode,
                    price,
                    comparePrice,
                    inventoryQuantity: 0,
                });
            }
        } else if (p.barcode) {
            items.push({
                barcode: p.barcode,
                price,
                comparePrice,
                inventoryQuantity: 0,
            });
        }
    }

    if (items.length === 0) return;

    await client.updateInventory(items);
}
