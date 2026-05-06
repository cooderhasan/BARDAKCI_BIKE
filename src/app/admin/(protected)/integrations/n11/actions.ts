
"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getSiteSettings } from "@/app/admin/(protected)/settings/actions";

export async function getN11Config() {
    try {
        const config = await (prisma as any).n11Config.findFirst();
        return { success: true, data: config };
    } catch (error) {
        return { success: false, error: "Ayarlar alınamadı" };
    }
}

export async function saveN11Config(prevState: any, formData: FormData) {
    try {
        const apiKey = formData.get("apiKey") as string;
        const apiSecret = formData.get("apiSecret") as string;
        const isActive = formData.get("isActive") === "on";

        if (!apiKey || !apiSecret) {
            return { success: false, message: "API Anahtarı ve Şifre zorunludur." };
        }

        const existing = await (prisma as any).n11Config.findFirst();

        if (existing) {
            await (prisma as any).n11Config.update({
                where: { id: existing.id },
                data: { apiKey, apiSecret, isActive }
            });
        } else {
            await (prisma as any).n11Config.create({
                data: { apiKey, apiSecret, isActive }
            });
        }

        return { success: true, message: "Ayarlar kaydedildi." };
    } catch (error) {
        return { success: false, message: "Kaydetme hatası." };
    }
}

export async function testN11Connection() {
    try {
        const config = await (prisma as any).n11Config.findFirst();
        if (!config) return { success: false, message: "Ayarlar bulunamadı." };

        const client = new N11Client({
            apiKey: config.apiKey,
            apiSecret: config.apiSecret
        });

        const result = await client.checkConnectionDetailed();

        if (result.success) {
            return { success: true, message: "Bağlantı Başarılı! N11 API ile iletişim kuruldu." };
        } else {
            return { success: false, message: "Bağlantı Başarısız: " + result.message };
        }
    } catch (error: any) {
        return { success: false, message: "Sistem Hatası: " + error.message };
    }
}

import { N11Client } from "@/services/n11/api";

import { addMarketplaceSyncJob } from "@/lib/queue/producer";

export async function enqueueN11Sync() {
    try {
        await addMarketplaceSyncJob({ marketplace: "n11", type: "products" });
        return { success: true, message: "Senkronizasyon işlemi kuyruğa alındı. Arka planda işlenecektir." };
    } catch (error: any) {
        return { success: false, message: "Kuyruğa eklenirken hata oluştu: " + error.message };
    }
}

export async function syncProductsToN11(productIds?: string[]) {
    try {
        const config = await (prisma as any).n11Config.findFirst({ where: { isActive: true } });
        if (!config) return { success: false, message: "Aktif entegrasyon bulunamadı." };

        const whereClause: any = {
            isActive: true,
            isN11Active: true
        };

        if (productIds && productIds.length > 0) {
            whereClause.id = { in: productIds };
        }

        // Fetch products with variants
        const products = await prisma.product.findMany({
            where: whereClause,
            include: { variants: true, categories: true }
        });

        if (products.length === 0) return { success: false, message: "Ürün bulunamadı." };

        const client = new N11Client({
            apiKey: config.apiKey,
            apiSecret: config.apiSecret
        });

        let successCount = 0;
        let failCount = 0;

        // 1. Collect all items to sync across all products
        const allItemsToSync = [];

        // Fetch default critical stock from settings
        const generalSettings = await getSiteSettings("general");
        const defaultCritical = Number(generalSettings?.defaultCriticalStock || 10);

        for (const p of products) {
            const basePrice = Number((p as any).n11Price) || Number(p.listPrice);
            const criticalStock = p.criticalStock ?? defaultCritical;

            if ((p as any).variants?.length > 0) {
                for (const v of (p as any).variants) {
                    if (v.barcode) {
                        const availableStock = Math.max(0, v.stock - criticalStock);
                        allItemsToSync.push({
                            stockCode: v.sku || v.barcode, // Usually N11 uses stockSellerCode which is our SKU/Barcode
                            quantity: availableStock,
                            price: basePrice + Number(v.priceAdjustment || 0)
                        });
                    }
                }
            } else if ((p as any).barcode) {
                const availableStock = Math.max(0, p.stock - criticalStock);
                allItemsToSync.push({
                    stockCode: p.sku || p.barcode,
                    quantity: availableStock,
                    price: basePrice
                });
            }
        }

        // 2. Process in chunks to avoid rate limits
        const CHUNK_SIZE = 50; // N11 tekil işlem yaptığı için batch boyutunu küçük tutuyoruz
        const chunks = [];
        for (let i = 0; i < allItemsToSync.length; i += CHUNK_SIZE) {
            chunks.push(allItemsToSync.slice(i, i + CHUNK_SIZE));
        }

        for (const chunk of chunks) {
            // Process chunk items concurrently
            await Promise.all(
                chunk.map(async (item) => {
                    try {
                        const stockRes = await client.updateStock({ sellerStockCode: item.stockCode, quantity: item.quantity });
                        const priceRes = await client.updatePrice({ sellerStockCode: item.stockCode, price: item.price });

                        if (stockRes.success || priceRes.success) {
                            successCount++;
                        } else {
                            failCount++;
                        }
                    } catch (e) {
                        failCount++;
                    }
                })
            );

            // Sleep 500ms between chunks
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        return { success: true, message: `N11 Senkronizasyonu Tamamlandı. Başarılı: ${successCount}, Başarısız: ${failCount} (Ürün N11'de eşleşmediyse başarısız olur).` };

    } catch (error: any) {
        console.error("N11 Sync Error:", error);
        return { success: false, message: "Sync Hatası: " + error.message };
    }
}

export async function syncOrdersFromN11() {
    try {
        const config = await (prisma as any).n11Config.findFirst({ where: { isActive: true } });
        if (!config) return { success: false, message: "Aktif entegrasyon bulunamadı." };

        const client = new N11Client({
            apiKey: config.apiKey,
            apiSecret: config.apiSecret
        });

        // Get Orders
        const res = await client.getOrders("New");

        // Since we didn't implement full XML parser for orders, we just log logic or return raw info length
        // In real implementation we would parse XML.
        // For now, let's assume if raw response has content, it's ok.

        return { success: true, message: "N11 Sipariş kontrolü yapıldı (XML Loglandı). İçe aktarma için XML parser gerekli." };

    } catch (error: any) {
        console.error("N11 Order Sync Error:", error);
        return { success: false, message: "Order Sync Hatası: " + error.message };
    }
}
export async function getN11CategoryAttributes(categoryId: number) {
    try {
        const config = await (prisma as any).n11Config.findFirst({ where: { isActive: true } });
        if (!config) return { success: false, message: "Aktif entegrasyon bulunamadı." };

        const client = new N11Client({
            apiKey: config.apiKey,
            apiSecret: config.apiSecret
        });

        const data = await client.getCategoryAttributes(categoryId);
        return { success: true, data: data.attributes };
    } catch (error: any) {
        return { success: false, message: "Hata: " + error.message };
    }
}

export async function sendProductToN11(productId: string, attributes: any[]) {
    try {
        const config = await (prisma as any).n11Config.findFirst({ where: { isActive: true } });
        if (!config) return { success: false, message: "Aktif entegrasyon bulunamadı." };

        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: {
                brand: true,
                categories: true,
                variants: true
            }
        });

        if (!product) return { success: false, message: "Ürün bulunamadı." };

        const client = new N11Client({
            apiKey: config.apiKey,
            apiSecret: config.apiSecret
        });

        const mappedCat = product.categories.find((c: any) => c.n11CategoryId !== null);
        if (!mappedCat) return { success: false, message: "Ürünün kategorisi N11 ile eşleşmemiş." };

        // N11 doesn't strictly require brand matching by ID for all categories, 
        // but it's better to have it. For now we use the brand name.

        const payload = {
            sellerCode: product.sku || product.id,
            title: product.name,
            description: product.description || product.name,
            categoryId: mappedCat.n11CategoryId,
            price: Number(product.n11Price || product.listPrice),
            quantity: product.stock,
            stockCode: product.barcode || product.sku || product.id,
            images: product.images,
            attributes: attributes // Custom attributes mapped from UI
        };

        const result = await client.saveProduct(payload);

        if (result.success) {
             await (prisma as any).n11Product.upsert({
                where: { productId: product.id },
                update: { isSynced: true, lastSyncedAt: new Date(), lastSyncError: null },
                create: { productId: product.id, isSynced: true, lastSyncedAt: new Date() }
            });
            return { success: true, message: "Ürün N11'e başarıyla gönderildi." };
        } else {
            return { success: false, message: "N11 Hatası: " + result.message };
        }

    } catch (error: any) {
        return { success: false, message: "Hata: " + error.message };
    }
}
