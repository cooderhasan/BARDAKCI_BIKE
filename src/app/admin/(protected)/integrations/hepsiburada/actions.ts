
"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getSiteSettings } from "@/app/admin/(protected)/settings/actions";
import { HepsiburadaClient } from "@/services/hepsiburada/api";

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

        // 1. Fetch products from DB
        const products = await prisma.product.findMany({
            where: {
                barcode: "6600014838091"
            },
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

                    const hbItem = {
                        merchantSku: v.sku || v.barcode,
                        availableStock: Math.round(availableStock),
                        price: Number(varPrice.toFixed(2)),
                        dispatchTime: 1,
                        cargoCompany1: "Yurtiçi Kargo",
                        maximumPurchasableQuantity: 100
                    };
                    console.log(`📦 HB Inventory Item (Variant):`, hbItem);
                    hbItems.push(hbItem);
                }
            } else {
                if (p.sku || p.barcode) {
                    const availableStock = Math.max(0, p.stock - criticalStock);
                    
                    const hbItem = {
                        merchantSku: p.sku || p.barcode,
                        availableStock: Math.round(availableStock),
                        price: Number(basePrice.toFixed(2)),
                        dispatchTime: 1,
                        cargoCompany1: "Yurtiçi Kargo",
                        maximumPurchasableQuantity: 100
                    };
                    console.log(`📦 HB Inventory Item:`, hbItem);
                    hbItems.push(hbItem);
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

export async function getHepsiburadaCategories() {
    try {
        const config = await (prisma as any).hepsiburadaConfig.findFirst({ where: { isActive: true } });
        if (!config) return { success: false, message: "Aktif entegrasyon bulunamadı." };

        const client = new HepsiburadaClient({
            username: config.username,
            password: config.password,
            merchantId: config.merchantId,
            isTestMode: config.isTestMode ?? true
        });

        const data = await client.getCategories({ size: 1000 });
        return { success: true, data: data.data || [] };
    } catch (error: any) {
        return { success: false, message: "Hata: " + error.message };
    }
}

export async function searchHepsiburadaCategories(query: string) {
    try {
        if (!query || query.length < 2) return { success: true, data: [] };

        const config = await (prisma as any).hepsiburadaConfig.findFirst({ where: { isActive: true } });
        if (!config) return { success: false, message: "Aktif entegrasyon bulunamadı." };

        const client = new HepsiburadaClient({
            username: config.username,
            password: config.password,
            merchantId: config.merchantId,
            isTestMode: config.isTestMode ?? true
        });

        // Search by name and ensure it's a leaf category
        // Increase size to 1000 to catch more results and filter locally for better accuracy
        const data = await client.getCategories({ name: query, leaf: true, size: 1000 });
        
        // Filter results locally to make sure query matches name or any part of the path
        const filteredData = (data.data || []).filter((c: any) => {
            const searchStr = `${c.name} ${c.paths?.join(" ")}`.toLowerCase();
            return searchStr.includes(query.toLowerCase());
        }).slice(0, 100);

        return { success: true, data: filteredData };
    } catch (error: any) {
        console.error("searchHepsiburadaCategories error:", error);
        return { success: false, message: "Hata: " + error.message };
    }
}
export async function getHepsiburadaCategoryAttributes(categoryId: string) {
    try {
        const config = await (prisma as any).hepsiburadaConfig.findFirst({ where: { isActive: true } });
        if (!config) return { success: false, message: "Aktif entegrasyon bulunamadı." };

        const client = new HepsiburadaClient({
            username: config.username,
            password: config.password,
            merchantId: config.merchantId || config.username,
            isTestMode: config.isTestMode ?? true,
        });

        const data = await client.getCategoryAttributes(categoryId);
        const attrs: any[] = [];
        if (data.data) {
            // Sadece kategoriye özel dinamik özellikleri ve varyant özelliklerini ekliyoruz
            // baseAttributes (fiyat, stok, görsel vs) arka planda otomatik gönderiliyor
            if (Array.isArray(data.data.attributes)) {
                attrs.push(...data.data.attributes);
            }
            if (Array.isArray(data.data.variantAttributes)) {
                attrs.push(...data.data.variantAttributes);
            }
        }
        return { success: true, data: attrs };
    } catch (error: any) {
        return { success: false, message: "Hata: " + error.message };
    }
}

export async function getHepsiburadaAttributeValues(categoryId: string, attributeId: string) {
    try {
        const config = await (prisma as any).hepsiburadaConfig.findFirst({ where: { isActive: true } });
        if (!config) return { success: false, message: "Aktif entegrasyon bulunamadı." };

        const client = new HepsiburadaClient({
            username: config.username,
            password: config.password,
            merchantId: config.merchantId || config.username,
            isTestMode: config.isTestMode ?? true,
        });

        const data = await client.getAttributeValues(categoryId, attributeId);
        return { success: true, data: data || [] };
    } catch (error: any) {
        return { success: false, message: "Hata: " + error.message };
    }
}

export async function updateHepsiburadaSku(productId: string, hbSku: string) {
    try {
        await (prisma as any).hepsiburadaProduct.upsert({
            where: { productId },
            update: { hbSku },
            create: { productId, hbSku }
        });
        return { success: true, message: "HB SKU güncellendi." };
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
            password: config.password,
            merchantId: config.merchantId || config.username,
            isTestMode: config.isTestMode ?? true,
        });

        const mappedCat = product.categories.find((c: any) => c.hbCategoryId !== null && c.hbCategoryId !== undefined);
        if (!mappedCat) return { success: false, message: "Ürünün kategorisi Hepsiburada ile eşleşmemiş." };

        const merchantId = config.merchantId || config.username;
        const hbPrice = Number((product as any).hepsiburadaPrice) || Number(product.listPrice);

        // HB payload format - resmi dokümantasyona uygun
        const payload = [{
            categoryId: Number((mappedCat as any).hbCategoryId),
            merchant: merchantId,
            attributes: {
                merchantSku: product.sku || product.barcode || product.id,
                VaryantGroupID: product.sku || product.id,
                Barcode: product.barcode || product.sku || "",
                UrunAdi: product.name,
                UrunAciklamasi: product.description || product.name,
                Marka: product.brand?.name || "Diğer",
                // Garanti Süresi (GarantiSuresi ID'si ile geliyor)
                GarantiSuresi: attributes.find(a => a.id === "GarantiSuresi") ? Number(attributes.find(a => a.id === "GarantiSuresi").value) : 24,
                kg: String(Number(product.weight) || 1),
                tax_vat_rate: String(product.vatRate || 20),
                price: String(hbPrice).replace(".", ","),
                stock: String(Math.max(0, product.stock - (product.criticalStock || 0))),
                // Görseller
                ...(product.images[0] ? { Image1: product.images[0] } : {}),
                ...(product.images[1] ? { Image2: product.images[1] } : {}),
                ...(product.images[2] ? { Image3: product.images[2] } : {}),
                ...(product.images[3] ? { Image4: product.images[3] } : {}),
                ...(product.images[4] ? { Image5: product.images[4] } : {}),
                // HB SKU (Katalog Kodu) varsa ekle (Buybox eşleşmesi için)
                ...((product as any).hepsiburadaProduct?.hbSku ? { hbSku: (product as any).hepsiburadaProduct.hbSku } : {}),
                // Kullanıcının girdiği dinamik kategori özellikleri (ID bazlı gönderim)
                ...attributes
                    .filter((attr: any) => attr.id !== "GarantiSuresi")
                    .reduce((acc: any, curr: any) => ({ ...acc, [curr.id]: curr.value }), {}),
            }
        }];

        console.log("📡 HB Product Payload:", JSON.stringify(payload).substring(0, 500));

        const result = await client.createProduct(payload);

        // Sonuç başarılı ise DB güncelle
        const trackingId = result?.trackingId || result?.id || null;

        await (prisma as any).hepsiburadaProduct.upsert({
            where: { productId: product.id },
            update: { 
                isSynced: true, 
                lastSyncedAt: new Date(), 
                lastSyncError: null,
                merchantSku: product.sku || product.barcode || product.id,
            },
            create: { 
                productId: product.id, 
                isSynced: true, 
                lastSyncedAt: new Date(),
                merchantSku: product.sku || product.barcode || product.id,
            }
        });

        return { 
            success: true, 
            message: `Ürün Hepsiburada'ya gönderildi! ${trackingId ? `Tracking ID: ${trackingId}` : ""}` 
        };

    } catch (error: any) {
        console.error("❌ HB Product Send Error:", error.message);
        return { success: false, message: "Hata: " + error.message };
    }
}

/**
 * SIT Test Siparişi Oluşturma
 * Sadece isTestMode true iken çalışır
 */
export async function createHepsiburadaTestOrder() {
    try {
        const config = await (prisma as any).hepsiburadaConfig.findFirst({ where: { isActive: true, isTestMode: true } });
        if (!config) return { success: false, message: "Aktif bir SIT (Test) bağlantısı bulunamadı." };

        // Test için kullanılacak bir ürün bul (barkodu olan herhangi bir ürün)
        const product = await prisma.product.findFirst({
            where: { isActive: true, barcode: { not: null } }
        });

        if (!product) return { success: false, message: "Test siparişi için sistemde barkodlu ürün bulunamadı." };

        // SIT Sipariş Oluşturma için özel STUB adresi
        const sitUrl = `https://oms-stub-external-sit.hepsiburada.com/orders/merchantId/${config.merchantId}`;
        
        const payload = {
            Customer: {
                CustomerId: "dfc8a27f-faae-4cb2-859c-8a7d50ee77be",
                Name: "Serinmotor SIT Test"
            },
            DeliveryAddress: {
                AddressDetail: "Test Adresi No 1",
                City: "İstanbul",
                District: "Kadıköy",
                Email: "test@serinmotor.com",
                Name: "Müşteri Adı",
                PhoneNumber: "905551112233",
                CountryCode: "TR"
            },
            LineItems: [{
                MerchantSku: product.sku || product.barcode,
                Quantity: 1,
                Price: {
                    Amount: Number(product.listPrice) || 150.0,
                    Currency: "TRY"
                },
                TotalPrice: {
                    Amount: Number(product.listPrice) || 150.0,
                    Currency: "TRY"
                },
                CargoCompanyId: 1 // Yurtiçi Kargo
            }]
        };

        const response = await fetch(sitUrl, {
            method: "POST",
            headers: {
                "Authorization": `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`,
                "Content-Type": "application/json",
                "User-Agent": "serinmotor_dev"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.text();
            console.error("❌ SIT Order Error:", response.status, err);
            throw new Error(`SIT Sipariş Hatası: ${response.status} - ${err}`);
        }

        return { success: true, message: "Hepsiburada SIT üzerinden hayali bir sipariş başarıyla oluşturuldu!" };

    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

