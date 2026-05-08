
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

        console.log("💾 N11 Saving Config:", { apiKey, isActive });

        const existing = await (prisma as any).n11Config.findFirst();

        if (existing) {
            await (prisma as any).n11Config.update({
                where: { id: existing.id },
                data: { apiKey, apiSecret, isActive }
            });
            console.log("✅ N11 Config Updated");
        } else {
            await (prisma as any).n11Config.create({
                data: { apiKey, apiSecret, isActive }
            });
            console.log("✅ N11 Config Created");
        }

        revalidatePath("/admin/integrations/n11");
        return { success: true, message: "N11 Ayarları başarıyla kaydedildi." };
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

        // Get Orders (Status: New)
        const response = await client.getOrders("New");
        const orders = response.orders || [];

        if (orders.length === 0) return { success: true, message: "Yeni N11 siparişi yok." };

        let importedCount = 0;

        for (const n11Order of orders) {
            const existing = await prisma.order.findUnique({
                where: { orderNumber: n11Order.orderNumber }
            });

            if (existing) continue;

            const orderItems = [];
            let total = 0;
            const items = n11Order.orderItemList || [];

            for (const item of items) {
                // Find product by sellerStockCode (which is our SKU/Barcode)
                let productId = "";
                let variantId = null;

                const variant = await prisma.productVariant.findFirst({
                    where: { OR: [{ sku: item.sellerStockCode }, { barcode: item.sellerStockCode }] },
                    include: { product: true }
                });

                if (variant) {
                    productId = variant.productId;
                    variantId = variant.id;
                } else {
                    const product = await prisma.product.findFirst({
                        where: { OR: [{ sku: item.sellerStockCode }, { barcode: item.sellerStockCode }] }
                    });
                    if (product) productId = product.id;
                }

                if (productId) {
                    const price = Number(item.price || 0);
                    const qty = Number(item.quantity || 1);

                    orderItems.push({
                        productId,
                        variantId,
                        productName: item.productName || "N11 Ürünü",
                        quantity: qty,
                        unitPrice: price,
                        discountRate: 0,
                        vatRate: 20,
                        lineTotal: price * qty
                    });
                    total += price * qty;
                }
            }

            if (orderItems.length > 0) {
                await prisma.order.create({
                    data: {
                        orderNumber: n11Order.orderNumber,
                        status: "CONFIRMED", // Start as confirmed since we auto-accept
                        total: Number(n11Order.totalAmount || total),
                        subtotal: total,
                        discountAmount: 0,
                        appliedDiscountRate: 0,
                        vatAmount: total * 0.2,
                        guestEmail: n11Order.buyer?.email || "n11@customer.com",
                        shippingAddress: {
                            fullName: n11Order.shippingAddress?.fullName || "N11 Müşterisi",
                            address: n11Order.shippingAddress?.address || "",
                            city: n11Order.shippingAddress?.city || "",
                            district: n11Order.shippingAddress?.district || ""
                        },
                        items: { create: orderItems }
                    }
                });

                // AUTOMATIC STOCK CONFIRMATION (Accept Order in N11)
                try {
                    const acceptRes = await client.acceptOrder(n11Order.id);
                    if (acceptRes.success) {
                        console.log(`✅ N11 Order ${n11Order.orderNumber} auto-accepted.`);
                    } else {
                        console.error(`❌ N11 Auto-Accept Error:`, acceptRes.message);
                    }
                } catch (acceptErr) {
                    console.error(`❌ N11 Auto-Accept Exception:`, acceptErr);
                }

                importedCount++;
            }
        }

        return { success: true, message: `${importedCount} yeni N11 siparişi başarıyla çekildi.` };

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

export async function getN11Categories(parentId?: number) {
    try {
        const config = await (prisma as any).n11Config.findFirst({ where: { isActive: true } });
        if (!config) return { success: false, message: "Aktif entegrasyon yok." };

        const client = new N11Client({
            apiKey: config.apiKey,
            apiSecret: config.apiSecret
        });

        if (parentId) {
            const res = await client.getSubCategories(parentId);
            return { success: true, data: res.categories };
        } else {
            const res = await client.getTopLevelCategories();
            return { success: true, data: res.categories };
        }
    } catch (error: any) {
        return { success: false, message: "Kategoriler alınamadı: " + error.message };
    }
}

// Full list for searching (This might be slow if many categories, but needed for flat search)
export async function getFlatN11Categories() {
    try {
        const config = await (prisma as any).n11Config.findFirst({ where: { isActive: true } });
        if (!config) return { success: false, message: "Aktif entegrasyon yok." };

        const client = new N11Client({
            apiKey: config.apiKey,
            apiSecret: config.apiSecret
        });

        const res = await client.getAllCategories();
        return res;
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
