
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

        // 1. Fetch products (Include variants + HB product mapping)
        const products = await prisma.product.findMany({
            where: whereClause,
            include: { variants: true, hepsiburadaProduct: true }
        });

        if (products.length === 0) return { success: false, message: "Ürün bulunamadı." };

        const hbItems: any[] = [];

        // 2. HB Listing'lerini çekip merchantSku -> hepsiburadaSku eşlemesi yap
        // Bu zorunlu: HB envanter güncellemesi için hepsiburadaSku ŞART!
        const client = new HepsiburadaClient({
            username: config.username,
            password: config.password,
            merchantId: config.merchantId || config.username,
            isTestMode: config.isTestMode ?? true,
        });

        let hbSkuMap: Record<string, string> = {};
        try {
            const listingsResponse = await client.getListings(500, 0);
            const listingsArray = listingsResponse?.listings || listingsResponse?.items || (Array.isArray(listingsResponse) ? listingsResponse : []);
            for (const l of listingsArray) {
                if (l.merchantSku && l.hepsiburadaSku) {
                    hbSkuMap[l.merchantSku] = l.hepsiburadaSku;
                }
            }
            console.log(`📋 HB Listing eşlemesi: ${Object.keys(hbSkuMap).length} ürün bulundu`);
        } catch (e: any) {
            console.error(`⚠️ HB Listing çekilemedi: ${e.message}`);
        }

        // Fetch default critical stock from settings
        const generalSettings = await getSiteSettings("general");
        const defaultCritical = Number(generalSettings?.defaultCriticalStock || 10);

        for (const p of products) {
            const basePrice = Number((p as any).hepsiburadaPrice) || Number(p.listPrice);
            const criticalStock = p.criticalStock ?? defaultCritical;

            // HB merchantSku: önce hepsiburadaProduct.merchantSku, sonra product.sku/barcode
            const hbMerchantSku = (p as any).hepsiburadaProduct?.merchantSku || p.sku || p.barcode || '';

            // Variants?
            if ((p as any).variants && (p as any).variants.length > 0) {
                for (const v of (p as any).variants) {
                    if (!v.sku && !v.barcode) continue;

                    const merchantSku = v.sku || v.barcode;
                    const hepsiburadaSku = hbSkuMap[merchantSku] || hbSkuMap[hbMerchantSku];
                    if (!hepsiburadaSku) {
                        console.log(`⚠️ HB SKU bulunamadı: ${merchantSku} - atlanıyor`);
                        continue;
                    }

                    const varPrice = basePrice + Number(v.priceAdjustment || 0);
                    const availableStock = Math.max(0, v.stock - criticalStock);

                    const hbItem = {
                        hepsiburadaSku,
                        merchantSku: merchantSku,
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
                const merchantSku = hbMerchantSku;
                const hepsiburadaSku = hbSkuMap[merchantSku];
                if (!hepsiburadaSku) {
                    console.log(`⚠️ HB SKU bulunamadı: ${merchantSku} (ürün: ${p.name}) - atlanıyor`);
                    continue;
                }

                const availableStock = Math.max(0, p.stock - criticalStock);
                
                const hbItem = {
                    hepsiburadaSku,
                    merchantSku,
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

        if (hbItems.length === 0) return { success: false, message: "HB'de eşleşen ürün bulunamadı. Önce ürünleri HB kataloğuna ekleyin." };

        // 3. Send to HB (client zaten yukarıda oluşturuldu)

        try {
            // Chunking logic for Hepsiburada
            const CHUNK_SIZE = 500;
            const chunks = [];
            for (let i = 0; i < hbItems.length; i += CHUNK_SIZE) {
                chunks.push(hbItems.slice(i, i + CHUNK_SIZE));
            }

            let successCount = 0;
            for (const chunk of chunks) {
                const uploadResult = await client.uploadInventory(chunk);
                const trackingId = uploadResult?.id;
                console.log(`✅ HB Upload OK - Tracking ID: ${trackingId}`);
                
                // 5 saniye bekleyip sonucu kontrol et
                if (trackingId) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    try {
                        const statusResult = await client.checkInventoryUploadStatus(trackingId);
                        console.log(`📊 HB Status: ${statusResult?.status}, Total: ${statusResult?.total}`);
                        if (statusResult?.errors?.length > 0) {
                            console.error(`❌ HB Upload Errors:`, JSON.stringify(statusResult.errors));
                        }
                    } catch(e: any) {
                        console.log(`⚠️ HB Status Check: ${e.message}`);
                    }
                }
                
                successCount += chunk.length;
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            return { success: true, message: `Hepsiburada Sync - ${successCount} varyant/ürün için stok ve fiyat güncellendi.` };
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

        console.log("📡 HB Product Payload (FULL):", JSON.stringify(payload, null, 2));

        const result = await client.createProduct(payload);

        // Sonuç başarılı ise tracking kontrol et
        const trackingId = result?.data?.trackingId || result?.trackingId || result?.id || null;
        console.log("📡 HB Product Upload Result:", JSON.stringify(result));

        // Tracking ID varsa 5 saniye sonra durumu kontrol et
        let trackingStatus = null;
        if (trackingId) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            try {
                const sitSuffix = (config.isTestMode ?? true) ? "-sit" : "";
                const statusUrl = `https://mpop${sitSuffix}.hepsiburada.com/product/api/products/status/${trackingId}`;
                const statusRes = await fetch(statusUrl, {
                    headers: {
                        "Authorization": `Basic ${Buffer.from(`${config.merchantId || config.username}:${config.password}`).toString("base64")}`,
                        "User-Agent": "serinmotor_dev",
                        "Accept": "application/json"
                    }
                });
                trackingStatus = await statusRes.text();
                console.log("📊 HB Product Tracking Status:", trackingStatus);
            } catch (e: any) {
                console.log("⚠️ Tracking check failed:", e.message);
            }
        }

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
        // SIT Sipariş Oluşturma için özel STUB adresi
        const sitUrl = `https://oms-stub-external-sit.hepsiburada.com/orders/merchantId/${config.merchantId}`;

        // Aktif listing'den gerçek SKU bilgilerini çek
        const client = new HepsiburadaClient({
            username: config.username,
            password: config.password,
            merchantId: config.merchantId || config.username,
            isTestMode: true,
        });

        let testSku = "HBV0000116MZS";
        let testMerchantSku = "DENEME22";
        let testPrice = 485;

        // Aktif listing'den ilk ürünü bul
        try {
            const listingsResponse = await client.getListings(10, 0);
            const listings = listingsResponse?.listings || [];
            const activeProduct = listings.find((l: any) => l.availableStock > 0 && l.price > 0);
            if (activeProduct) {
                testSku = activeProduct.hepsiburadaSku;
                testMerchantSku = activeProduct.merchantSku;
                testPrice = activeProduct.price;
                console.log(`🛒 Test siparişi için aktif ürün: ${testSku} (${testMerchantSku}) - ${testPrice} TL`);
            }
        } catch (e: any) {
            console.log("⚠️ Listing çekilemedi, varsayılan SKU kullanılacak:", e.message);
        }

        const orderId = `HB${Date.now()}`;
        const lineItemId = crypto.randomUUID();
        const merchantId = config.merchantId || config.username;

        // HB SIT sipariş formatı - PascalCase (OrderLines, OrderNumber vb.)
        const payload = {
            OrderNumber: orderId,
            OrderDate: new Date().toISOString(),
            OrderLines: [{
                Id: lineItemId,
                ProductName: "SIT Test Ürünü",
                Sku: testSku,
                MerchantSku: testMerchantSku,
                Quantity: 1,
                MerchantId: merchantId,
                TotalPrice: {
                    Currency: "TRY",
                    Amount: testPrice
                },
                UnitPrice: {
                    Currency: "TRY",
                    Amount: testPrice
                },
                Vat: {
                    Currency: "TRY",
                    Amount: Number((testPrice * 0.20).toFixed(2))
                },
                VatRate: 20,
                CustomerName: "Serinmotor Test",
                CustomerId: "dfc8a27f-faae-4cb2-859c-8a7d50ee77be",
                Status: "Delivered",
                DueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                LastStatusUpdateDate: new Date().toISOString(),
                ShippingAddress: {
                    AddressId: crypto.randomUUID(),
                    Address: "Test Mahallesi Test Caddesi No:1 Kadıköy",
                    Name: "Test Müşteri",
                    Email: "test@serinmotor.com",
                    CountryCode: "TR",
                    PhoneNumber: "905551112233",
                    City: "İstanbul",
                    Town: "KADIKÖY"
                },
                Invoice: {
                    Address: {
                        AddressId: crypto.randomUUID(),
                        Address: "Fatura Adresi Test No:1 Kadıköy",
                        Name: "Test Müşteri",
                        Email: "test@serinmotor.com"
                    }
                }
            }]
        };

        console.log("🛒 SIT Order Payload:", JSON.stringify(payload, null, 2));

        const response = await fetch(sitUrl, {
            method: "POST",
            headers: {
                "Authorization": `Basic ${Buffer.from(`${merchantId}:${config.password}`).toString("base64")}`,
                "Content-Type": "application/json",
                "User-Agent": "serinmotor_dev"
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        console.log(`🛒 SIT Order Response (${response.status}):`, responseText);

        if (!response.ok) {
            return { success: false, message: `HB SIT Hatası: ${response.status} - ${responseText}` };
        }

        return { success: true, message: `Hepsiburada SIT test siparişi oluşturuldu! Order: ${orderId} (${testMerchantSku})` };

    } catch (error: any) {
        console.error("❌ SIT Order Exception:", error);
        return { success: false, message: `Sistem Hatası: ${error.message}` };
    }
}

