
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

        // 2. Process in chunks (N11 allows up to 1000 skus per task)
        const CHUNK_SIZE = 1000;
        const chunks = [];
        for (let i = 0; i < allItemsToSync.length; i += CHUNK_SIZE) {
            chunks.push(allItemsToSync.slice(i, i + CHUNK_SIZE));
        }

        for (const chunk of chunks) {
            const result = await client.updateStockAndPrice(chunk);
            if (result.success) {
                successCount += chunk.length;
            } else {
                failCount += chunk.length;
            }
        }

        return { success: true, message: `N11 Senkronizasyonu Tamamlandı. ${successCount} varyant/ürün güncellendi.` };

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

        // Official Doc: Fetching "Created" status (New orders)
        const response = await client.getOrders("Created");
        if (!response.success) throw new Error(response.message);

        // Official Doc: Orders are in 'content' array as packages
        const packages = response.content || [];
        let importedCount = 0;

        for (const pkg of packages) {
            // Check if this order package already exists in our DB
            const existing = await prisma.order.findUnique({
                where: { orderNumber: pkg.orderNumber }
            });

            if (existing) continue;

            const orderItems: any[] = [];
            const lineIds: number[] = [];
            let total = 0;

            // Official Doc: Each package has 'lines'
            for (const line of (pkg.lines || [])) {
                lineIds.push(line.orderLineId);
                
                // Find product by barcode or stockCode
                const product = await prisma.product.findFirst({
                    where: {
                        OR: [
                            { barcode: line.barcode || undefined },
                            { sku: line.stockCode || undefined }
                        ]
                    }
                });

                if (product) {
                    orderItems.push({
                        productId: product.id,
                        quantity: line.quantity,
                        unitPrice: line.price,
                        productName: line.productName,
                        lineTotal: line.price * line.quantity,
                        vatRate: line.vatRate || 20
                    });
                    total += line.price * line.quantity;

                    // Update local stock
                    await prisma.product.update({
                        where: { id: product.id },
                        data: { stock: { decrement: line.quantity } }
                    });
                }
            }

            if (orderItems.length > 0) {
                await prisma.order.create({
                    data: {
                        orderNumber: pkg.orderNumber,
                        status: "CONFIRMED",
                        total: pkg.totalAmount || total,
                        subtotal: total,
                        discountAmount: pkg.totalDiscountAmount || 0,
                        appliedDiscountRate: 0,
                        vatAmount: total * 0.2, // Default VAT
                        guestEmail: pkg.customerEmail || "n11@customer.com",
                        shippingAddress: {
                            fullName: pkg.shippingAddress?.fullName || pkg.customerfullName || "N11 Müşterisi",
                            address: pkg.shippingAddress?.address || "",
                            city: pkg.shippingAddress?.city || "",
                            district: pkg.shippingAddress?.district || ""
                        },
                        items: { create: orderItems }
                    }
                });

                // AUTOMATIC STOCK CONFIRMATION (Official: PUT /rest/order/v1/update with status 'Picking')
                try {
                    const acceptRes = await client.acceptOrder(lineIds);
                    if (acceptRes.success) {
                        console.log(`✅ N11 Package ${pkg.id} (Order ${pkg.orderNumber}) auto-accepted via Picking status.`);
                    } else {
                        console.error(`❌ N11 Auto-Accept Error for Order ${pkg.orderNumber}:`, acceptRes.message);
                    }
                } catch (acceptErr) {
                    console.error(`❌ N11 Auto-Accept Exception for Order ${pkg.orderNumber}:`, acceptErr);
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

        if (result.success && result.taskId) {
            // Wait for 5 seconds for N11 to process the task
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Poll task details for final result
            const taskRes = await client.getTaskDetails(result.taskId);
            
            if (taskRes.success) {
                const task = taskRes.data;
                const status = task.status; // COMPLETED, FAILED, IN_PROGRESS
                
                if (status === "COMPLETED") {
                    await (prisma as any).n11Product.upsert({
                        where: { productId: product.id },
                        update: { isSynced: true, lastSyncedAt: new Date(), lastSyncError: null },
                        create: { productId: product.id, isSynced: true, lastSyncedAt: new Date() }
                    });
                    return { success: true, message: "Ürün N11'e başarıyla yüklendi ve yayınlandı." };
                } else if (status === "FAILED") {
                    const errorMsg = task.items?.[0]?.errorMsg || "N11 tarafında işleme hatası oluştu.";
                    return { success: false, message: "N11 İşleme Hatası: " + errorMsg };
                } else {
                    return { success: true, message: `Ürün N11 kuyruğuna alındı ancak henüz sonuçlanmadı. Takip No: ${result.taskId}. Birazdan tekrar kontrol edebilirsiniz.` };
                }
            }
            
            return { success: true, message: "Ürün N11 kuyruğuna iletildi. Sonuç için birazdan senkronizasyon yapabilirsiniz." };
        } else {
            return { success: false, message: "N11 İletim Hatası: " + result.message };
        }

    } catch (error: any) {
        return { success: false, message: "Hata: " + error.message };
    }
}
