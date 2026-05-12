
"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getSiteSettings } from "@/app/admin/(protected)/settings/actions";

export async function getHepsiburadaConfig() {
    try {
        const config = await (prisma as any).hepsiburadaConfig.findFirst();
        return { success: true, data: config };
    } catch (error) {
        return { success: false, error: "Ayarlar alınamadı" };
    }
}

export async function saveHepsiburadaConfig(prevState: any, formData: FormData) {
    try {
        const username = formData.get("username") as string; // Merchant ID
        const password = formData.get("password") as string; // Secret Key
        const merchantId = formData.get("merchantId") as string;
        const isActive = formData.get("isActive") === "on";
        const isTestMode = formData.get("isTestMode") === "on";

        if (!username || !password) {
            return { success: false, message: "Merchant ID ve Secret Key zorunludur." };
        }

        console.log("💾 HB Saving Config:", { username, merchantId, isActive, isTestMode });

        const existing = await (prisma as any).hepsiburadaConfig.findFirst();

        if (existing) {
            await (prisma as any).hepsiburadaConfig.update({
                where: { id: existing.id },
                data: { username, password, merchantId, isActive, isTestMode }
            });
            console.log("✅ HB Config Updated");
        } else {
            await (prisma as any).hepsiburadaConfig.create({
                data: { username, password, merchantId, isActive, isTestMode }
            });
            console.log("✅ HB Config Created");
        }

        revalidatePath("/admin/integrations/hepsiburada");
        return { success: true, message: "Ayarlar başarıyla kaydedildi." };
    } catch (error) {
        console.error("HB Save Error:", error);
        return { success: false, message: "Kaydetme hatası." };
    }
}

export async function testHepsiburadaConnection() {
    try {
        const config = await (prisma as any).hepsiburadaConfig.findFirst();
        if (!config) return { success: false, message: "Ayarlar bulunamadı." };

        const client = new HepsiburadaClient({
            username: config.username,
            password: config.password,
            merchantId: config.merchantId,
            isTestMode: config.isTestMode ?? true,
        });

        const result = await client.checkConnectionDetailed();

        if (result.success) {
            return { success: true, message: "Bağlantı Başarılı! Hepsiburada API ile iletişim kuruldu." };
        } else {
            return { success: false, message: "Bağlantı Başarısız: " + result.message };
        }
    } catch (error: any) {
        return { success: false, message: "Sistem Hatası: " + error.message };
    }
}

import { HepsiburadaClient } from "@/services/hepsiburada/api";

// ... (get and save config remain same)

import { addMarketplaceSyncJob } from "@/lib/queue/producer";

export async function enqueueHepsiburadaSync() {
    try {
        await addMarketplaceSyncJob({ marketplace: "hepsiburada", type: "products" });
        return { success: true, message: "Senkronizasyon işlemi kuyruğa alındı. Arka planda işlenecektir." };
    } catch (error: any) {
        return { success: false, message: "Kuyruğa eklenirken hata oluştu: " + error.message };
    }
}

export async function syncProductsToHepsiburada(productIds?: string[]) {
    try {
        const config = await (prisma as any).hepsiburadaConfig.findFirst({ where: { isActive: true } });
        if (!config) return { success: false, message: "Aktif entegrasyon bulunamadı." };

        const whereClause: any = {
            isActive: true,
            isHepsiburadaActive: true
        };

        if (productIds && productIds.length > 0) {
            whereClause.id = { in: productIds };
        }

        // 1. Fetch products (Include variants)
        const products = await prisma.product.findMany({
            where: whereClause,
            include: { variants: true }
        });

        if (products.length === 0) return { success: false, message: "Ürün bulunamadı." };

        const hbItems: any[] = [];

        // 2. Map to Hepsiburada format (simplified inventory payload)
        // HB Inventory: { merchantSku, availableStock, price, dispatchTime, cargoCompany1, cargoCompany2, cargoCompany3, maximumPurchasableQuantity }

        // Fetch default critical stock from settings
        const generalSettings = await getSiteSettings("general");
        const defaultCritical = Number(generalSettings?.defaultCriticalStock || 10);

        for (const p of products) {
            const basePrice = Number((p as any).hepsiburadaPrice) || Number(p.listPrice); // Use HB price if available
            const criticalStock = p.criticalStock ?? defaultCritical;

            // Variants?
            if ((p as any).variants && (p as any).variants.length > 0) {
                for (const v of (p as any).variants) {
                    if (!v.sku && !v.barcode) continue; // Need identifier (MerchantSku)

                    const varPrice = basePrice + Number(v.priceAdjustment || 0);
                    const availableStock = Math.max(0, v.stock - criticalStock);

                    hbItems.push({
                        merchantSku: v.sku || v.barcode, // Important: Must match HB Listing SKU
                        availableStock: availableStock,
                        price: varPrice,
                        dispatchTime: 3, // Default dispatch time
                        cargoCompany1: "DHL eCommerce",
                        maximumPurchasableQuantity: 10
                    });
                }
            } else {
                if (p.sku || p.barcode) {
                    const availableStock = Math.max(0, p.stock - criticalStock);
                    
                    hbItems.push({
                        merchantSku: p.sku || p.barcode,
                        availableStock: availableStock,
                        price: basePrice,
                        dispatchTime: 3,
                        cargoCompany1: "DHL eCommerce",
                        maximumPurchasableQuantity: 10
                    });
                }
            }
        }

        if (hbItems.length === 0) return { success: false, message: "Gönderilecek uygun (SKU/Barkod'lu) ürün bulunamadı." };

        // 3. Send to HB
        const client = new HepsiburadaClient({
            username: config.username,
            password: config.password,
            merchantId: config.merchantId || config.username,
            isTestMode: config.isTestMode ?? true,
        });

        try {
            // Chunking logic for Hepsiburada
            const CHUNK_SIZE = 500;
            const chunks = [];
            for (let i = 0; i < hbItems.length; i += CHUNK_SIZE) {
                chunks.push(hbItems.slice(i, i + CHUNK_SIZE));
            }

            let successCount = 0;
            for (const chunk of chunks) {
                await client.uploadInventory(chunk);
                successCount += chunk.length;
                await new Promise(resolve => setTimeout(resolve, 500)); // Sleep between chunks
            }
            
            return { success: true, message: `${successCount} varyant/ürün için stok ve fiyat güncellendi.` };
        } catch (apiError: any) {
            return { success: false, message: "HB API Hatası: " + apiError.message };
        }

    } catch (error: any) {
        console.error("HB Sync Error:", error);
        return { success: false, message: "Sync Hatası: " + error.message };
    }
}

export async function syncOrdersFromHepsiburada() {
    try {
        const config = await (prisma as any).hepsiburadaConfig.findFirst({ where: { isActive: true } });
        if (!config) return { success: false, message: "Aktif entegrasyon bulunamadı." };

        const client = new HepsiburadaClient({
            username: config.username,
            password: config.password,
            merchantId: config.merchantId || config.username,
            isTestMode: config.isTestMode ?? true,
        });

        // 1. Fetch HB Orders
        // HB API returns { data: [...], totalCount: X }
        const response = await client.getOrders({ status: "New" }); 
        const orders = response.data || [];

        if (orders.length === 0) return { success: true, message: "Yeni Hepsiburada siparişi yok." };

        // 2. Import logic
        let importedCount = 0;

        for (const hbOrder of orders) {
            const existing = await prisma.order.findUnique({
                where: { orderNumber: hbOrder.orderNumber }
            });

            if (existing) continue;

            const orderItems = [];
            let total = 0;
            const items = Array.isArray(hbOrder.items) ? hbOrder.items : [];

            for (const item of items) {
                // HB uses MerchantSKU which could be our SKU or Barcode
                // We should search both Product and Variant
                let productId = "";
                let variantId = null;

                // 1. Try Variant (SKU or Barcode)
                const variant = await prisma.productVariant.findFirst({
                    where: {
                        OR: [
                            { sku: item.merchantSku },
                            { barcode: item.merchantSku }
                        ]
                    },
                    include: { product: true }
                });

                if (variant) {
                    productId = variant.productId;
                    variantId = variant.id;
                } else {
                    // 2. Try Product
                    const product = await prisma.product.findFirst({
                        where: {
                            OR: [
                                { sku: item.merchantSku },
                                { barcode: item.merchantSku }
                            ]
                        }
                    });
                    if (product) productId = product.id;
                }

                if (productId) {
                    const qty = item.quantity || 1;
                    const price = Number(item.price?.amount || item.totalPrice?.amount || 0) / qty; // HB structure varies

                    orderItems.push({
                        productId,
                        variantId,
                        productName: item.productName || "HB Ürünü",
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
                        orderNumber: hbOrder.orderNumber,
                        status: "PENDING",
                        total: Number(hbOrder.totalPrice?.amount || total),
                        subtotal: total,
                        discountAmount: 0,
                        appliedDiscountRate: 0,
                        vatAmount: total * 0.2, // Rough
                        guestEmail: hbOrder.customer?.email || "hb@customer.com",
                        shippingAddress: {
                            fullName: hbOrder.shippingAddress?.name || "HB Müşterisi",
                            address: hbOrder.shippingAddress?.address || "",
                            city: hbOrder.shippingAddress?.city || "",
                            district: hbOrder.shippingAddress?.district || ""
                        },
                        items: { create: orderItems }
                    }
                });
                importedCount++;
            }
        }

        return { success: true, message: `${importedCount} sipariş başarıyla çekildi.` };

    } catch (error: any) {
        console.error("HB Order Sync Error:", error);
        return { success: false, message: "Order Sync Hatası: " + error.message };
    }
}
export async function getHepsiburadaCategoryAttributes(categoryId: string) {
    try {
        const config = await (prisma as any).hepsiburadaConfig.findFirst({ where: { isActive: true } });
        if (!config) return { success: false, message: "Aktif entegrasyon bulunamadı." };

        const client = new HepsiburadaClient({
            username: config.username,
            password: config.password
        });

        const data = await client.getCategoryAttributes(categoryId);
        return { success: true, data: data.data || [] }; // HB metadata returns { data: [...] }
    } catch (error: any) {
        return { success: false, message: "Hata: " + error.message };
    }
}

export async function sendProductToHepsiburada(productId: string, attributes: any[]) {
    try {
        const config = await (prisma as any).hepsiburadaConfig.findFirst({ where: { isActive: true } });
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

        const client = new HepsiburadaClient({
            username: config.username,
            password: config.password
        });

        const mappedCat = product.categories.find((c: any) => c.hepsiburadaCategoryId !== null);
        if (!mappedCat) return { success: false, message: "Ürünün kategorisi Hepsiburada ile eşleşmemiş." };

        // Transformation logic for HB Catalog Upload
        const payload = [{
            merchantSku: product.sku || product.barcode || product.id,
            attributes: {
                ...attributes.reduce((acc, curr) => ({ ...acc, [curr.name]: curr.value }), {}),
                "product_name": product.name,
                "brand": product.brand?.name || "Diğer",
                "category_id": mappedCat.hepsiburadaCategoryId,
                "description": product.description || product.name,
                "image1": product.images[0] || "",
                "price": product.listPrice,
                "vat": product.vatRate
            }
        }];

        const result = await client.createProduct(payload);

        if (result.success) {
            await (prisma as any).hepsiburadaProduct.upsert({
                where: { productId: product.id },
                update: { isSynced: true, lastSyncedAt: new Date(), lastSyncError: null },
                create: { productId: product.id, isSynced: true, lastSyncedAt: new Date() }
            });
            return { success: true, message: "Hepsiburada ürün talebi başarıyla oluşturuldu." };
        } else {
            return { success: false, message: "HB Hatası: " + (result.message || "Bilinmeyen hata") };
        }

    } catch (error: any) {
        return { success: false, message: "Hata: " + error.message };
    }
}
