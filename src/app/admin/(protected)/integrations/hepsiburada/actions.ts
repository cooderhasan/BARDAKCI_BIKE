
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

export async function syncOrdersFromHepsiburada(specificOrderNumber?: string) {
    try {
        const config = await (prisma as any).hepsiburadaConfig.findFirst({ where: { isActive: true } });
        if (!config) return { success: false, message: "Aktif entegrasyon bulunamadı." };

        const client = new HepsiburadaClient({
            username: config.username,
            password: config.password,
            merchantId: config.merchantId,
            isTestMode: config.isTestMode ?? false,
        });

        let allItems: any[] = [];

        if (specificOrderNumber) {
            try {
                const res = await client.getOrderByNumber(specificOrderNumber);
                const items = res?.items || (Array.isArray(res) ? res : [res]);
                if (items && items.length > 0) {
                    console.log(`📦 HB Specific Order '${specificOrderNumber}': ${items.length} kalem bulundu`);
                    allItems.push(...items);
                }
            } catch (err: any) {
                console.warn(`⚠️ HB Specific Order '${specificOrderNumber}' çekilemedi:`, err.message);
                return { success: false, message: `Sipariş Hepsiburada'dan çekilemedi: ${err.message}` };
            }
        } else {
            // HB sipariş durumları: New, Approved, Unacked, Packed
            for (const status of ["New", "Approved", "Unacked", "Packed"]) {
                try {
                    const res = await client.getOrders({ status, size: 100 });
                    if (res?.items && res.items.length > 0) {
                        console.log(`📦 HB ${status}: ${res.items.length} sipariş bulundu`);
                        allItems.push(...res.items);
                    }
                } catch (err: any) {
                    console.warn(`⚠️ HB ${status} siparişleri çekilirken hata:`, err.message);
                }
            }
        }

        if (allItems.length === 0) {
            return { success: true, message: "Hepsiburada siparişi bulunamadı." };
        }

        let importedCount = 0;
        let skippedCount = 0;

        for (const item of allItems) {
            try {
                // HB her satır ayrı item olarak gelir, orderNumber ile grupla
                const orderNumber = item.orderNumber || item.orderId || String(item.id);

                // Daha önce import edilmiş mi?
                const existing = await prisma.order.findUnique({
                    where: { orderNumber }
                });
                if (existing) {
                    skippedCount++;
                    continue;
                }

                // Ürünü bul (HepsiburadaProduct eşleşmelerinden veya doğrudan merchantSku, sku, barcode ile)
                let product = null;

                const merchantSkuVal = item.merchantSku || item.merchantSKU;
                
                // 1. Önce HepsiburadaProduct tablosundaki özel sihirbaz eşleşmelerine bakalım
                const hbConditions: any[] = [];
                if (merchantSkuVal) {
                    hbConditions.push({ merchantSku: String(merchantSkuVal) });
                }
                if (item.sku) {
                    hbConditions.push({ hbSku: String(item.sku) });
                    hbConditions.push({ merchantSku: String(item.sku) });
                }

                if (hbConditions.length > 0) {
                    const hbMapping = await prisma.hepsiburadaProduct.findFirst({
                        where: { OR: hbConditions },
                        include: { product: true }
                    });
                    if (hbMapping && hbMapping.product) {
                        product = hbMapping.product;
                    }
                }

                // 2. Eğer özel eşleşme bulunamazsa, doğrudan Product tablosundaki sku ve barkod ile eşleştir
                if (!product) {
                    const searchConditions: any[] = [];
                    if (merchantSkuVal) searchConditions.push({ sku: String(merchantSkuVal) });
                    if (item.sku) searchConditions.push({ sku: String(item.sku) });
                    if (item.barcode) searchConditions.push({ barcode: String(item.barcode) });

                    if (searchConditions.length > 0) {
                        product = await prisma.product.findFirst({
                            where: { OR: searchConditions }
                        });
                    }
                }

                // Fiyat bilgileri
                const unitPrice = item.unitPrice?.amount || item.unitPrice || item.totalPrice?.amount || 0;
                const quantity = item.quantity || 1;
                const lineTotal = unitPrice * quantity;
                const vatRate = item.vatRate || item.vat || 20;

                // Sipariş kalemlerini oluştur
                const orderItems: any[] = [{
                    productId: product?.id || null,
                    quantity: quantity,
                    unitPrice: unitPrice,
                    productName: item.name || item.productName || "HB Ürün",
                    lineTotal: lineTotal,
                    vatRate: vatRate,
                    discountRate: 0
                }];

                // Müşteri ve adres bilgileri
                const shipping = item.shippingAddress || {};
                const invoice = item.invoice || {};
                const customerName = shipping.name || item.customerName || "Hepsiburada Müşterisi";
                const customerEmail = shipping.email || item.customerEmail || "hb@customer.com";
                const customerPhone = shipping.phoneNumber || shipping.phone || "";

                // Fatura bilgileri (VKN/TCKN)
                const taxNumber = invoice.taxNumber || invoice.turkishIdentityNumber || "";
                const taxOffice = invoice.taxOffice || "";

                await prisma.order.create({
                    data: {
                        orderNumber: orderNumber,
                        status: "CONFIRMED",
                        total: item.totalPrice?.amount || lineTotal,
                        subtotal: lineTotal,
                        discountAmount: item.hbDiscount?.amount || item.discountPriceToBeInvoicedHb || 0,
                        appliedDiscountRate: 0,
                        vatAmount: lineTotal * (vatRate / (100 + vatRate)),
                        guestEmail: customerEmail,
                        shippingAddress: {
                            fullName: customerName,
                            address: shipping.address || "",
                            city: shipping.city || "",
                            district: shipping.town || shipping.district || "",
                            phone: customerPhone,
                            taxNumber: taxNumber || undefined,
                            taxOffice: taxOffice || undefined,
                        },
                        items: {
                            create: orderItems.filter(i => i.productId)
                        },
                        source: "HEPSIBURADA",
                        cargoCompany: item.cargoCompany || (item.cargoCompanyModel && item.cargoCompanyModel.name) || item.shippingCompanyName || null,
                        shipmentPackageId: String(item.packageNumber || item.id || ""),
                    }
                });

                // Stok düş
                if (product) {
                    await prisma.product.update({
                        where: { id: product.id },
                        data: { stock: { decrement: quantity } }
                    });
                }

                importedCount++;
                console.log(`✅ HB Sipariş import edildi: ${orderNumber}`);

            } catch (orderErr: any) {
                console.error(`❌ HB Sipariş import hatası:`, orderErr.message);
            }
        }

        const msg = `${importedCount} yeni HB siparişi import edildi.${skippedCount > 0 ? ` (${skippedCount} zaten mevcut)` : ""}`;
        return { success: true, message: msg };

    } catch (error: any) {
        console.error("HB Order Sync Error:", error);
        return { success: false, message: "Sipariş çekme hatası: " + error.message };
    }
}

export async function syncProductsToHepsiburada(productIds?: string[]) {
    try {
        const config = await (prisma as any).hepsiburadaConfig.findFirst({ where: { isActive: true } });
        if (!config) return { success: false, message: "Aktif entegrasyon bulunamadı." };

        const whereClause: any = {
            isActive: true
        };

        if (productIds && productIds.length > 0) {
            whereClause.id = { in: productIds };
        } else {
            whereClause.isHepsiburadaActive = true;
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
            let offset = 0;
            let limit = 100;
            let hasMore = true;
            let pageNum = 1;
            console.log(`📡 HB Listing çekimi başlıyor (Sayfalı)...`);
            while (hasMore) {
                const listingsResponse = await client.getListings(limit, offset);
                const listingsArray = listingsResponse?.listings || listingsResponse?.items || (Array.isArray(listingsResponse) ? listingsResponse : []);
                if (listingsArray.length === 0) {
                    hasMore = false;
                } else {
                    for (const l of listingsArray) {
                        // HAM VERİ ARAMASI (Hiçbir filtreye takılmadan)
                        const rawStr = JSON.stringify(l);
                        if (rawStr.includes("HBCV000007MQETQ")) {
                            console.log(`🔍 DEBUG - RAW MATCH FOUND IN LISTINGS:`, rawStr);
                        }

                        if (l.merchantSku && l.hepsiburadaSku) {
                            hbSkuMap[l.merchantSku] = l.hepsiburadaSku;
                        }
                    }
                    console.log(`   📄 HB Sayfa ${pageNum} çekildi: ${listingsArray.length} ürün geldi.`);
                    if (listingsArray.length < limit) {
                        hasMore = false;
                    } else {
                        offset += limit;
                        pageNum++;
                    }
                }
            }
            console.log(`📋 HB Toplam Eşleşen Listing: ${Object.keys(hbSkuMap).length} ürün bulundu`);
            const target = "HBCV000007MQETQ";
            const foundKeys = Object.entries(hbSkuMap).filter(([k, v]) => k.includes(target) || v.includes(target));
            if (foundKeys.length > 0) {
                console.log(`🔍 DEBUG - Target '${target}' eşleşmeleri:`, JSON.stringify(foundKeys));
            } else {
                console.log(`🔍 DEBUG - Target '${target}' HB Listing Map içinde bulunamadı!`);
            }
            // İlk 30 ilanın stok ve katalog kodlarını yazdır
            const samples = Object.entries(hbSkuMap).slice(0, 30);
            console.log(`🔍 DEBUG - Hepsiburada'dan Dönen Örnek İlk 30 İlan:`, JSON.stringify(samples));
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
                    const hepsiburadaSku = hbSkuMap[merchantSku] || hbSkuMap[hbMerchantSku] || (p as any).hepsiburadaProduct?.hbSku;
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
                const hepsiburadaSku = hbSkuMap[merchantSku] || (p as any).hepsiburadaProduct?.hbSku;
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

// Server-side cache for HB categories (avoid re-fetching 6500 categories on every search)
let hbCategoryCache: { data: any[]; timestamp: number } | null = null;
const HB_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 gün (pratikte deploy'a kadar)

async function getHBCategoriesCached(): Promise<any[]> {
    if (hbCategoryCache && Date.now() - hbCategoryCache.timestamp < HB_CACHE_TTL) {
        return hbCategoryCache.data;
    }

    const config = await (prisma as any).hepsiburadaConfig.findFirst({ where: { isActive: true } });
    if (!config) throw new Error("Aktif entegrasyon bulunamadı.");

    const client = new HepsiburadaClient({
        username: config.username,
        password: config.password,
        merchantId: config.merchantId,
        isTestMode: config.isTestMode ?? true
    });

    console.log("📡 HB Kategorileri cache'leniyor (ilk yükleme)...");
    const data = await client.getCategories({ status: "ACTIVE" });
    const categories = data.data || [];
    console.log(`✅ HB ${categories.length} kategori cache'lendi.`);

    hbCategoryCache = { data: categories, timestamp: Date.now() };
    return categories;
}

export async function searchHepsiburadaCategories(query: string) {
    try {
        if (!query || query.length < 2) return { success: true, data: [] };

        const allCategories = await getHBCategoriesCached();

        // Arama terimlerini ayır (boşlukla birden fazla kelime destekle)
        const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);

        // Hem kategori adında hem de path'lerinde ara
        const filteredData = allCategories.filter((c: any) => {
            const searchStr = `${c.name} ${c.displayName || ""} ${(c.paths || []).join(" ")}`.toLowerCase();
            // Tüm terimler eşleşmeli (AND mantığı)
            return terms.every(term => searchStr.includes(term));
        });

        // Sadece leaf kategorileri öncelikle göster, sonra diğerleri
        const sorted = filteredData.sort((a: any, b: any) => {
            if (a.leaf && !b.leaf) return -1;
            if (!a.leaf && b.leaf) return 1;
            return 0;
        }).slice(0, 50);

        return { success: true, data: sorted };
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

        const rawData = await client.getAttributeValues(categoryId, attributeId);
        
        // 1. Dönen verinin dizi (array) veya sayfalı obje (paginated object) olduğunu belirle
        let items: any[] = [];
        if (Array.isArray(rawData)) {
            items = rawData;
        } else if (rawData && Array.isArray((rawData as any).content)) {
            items = (rawData as any).content;
        } else if (rawData && typeof rawData === 'object') {
            // Eğer doğrudan bir nesne ise ve içinde array barındıran bir anahtar varsa bulmaya çalış
            const foundArray = Object.values(rawData).find(val => Array.isArray(val));
            if (foundArray) items = foundArray as any[];
        }

        // 2. Nitelik değerlerini standardize et ({ id, value } formatına dönüştür)
        const formattedData = items.map((item: any) => {
            if (typeof item === 'string') {
                return { id: item, value: item };
            }
            if (item && typeof item === 'object') {
                const id = item.attributeValueId || item.id || item.valueId || "";
                const value = item.attributeValue || item.value || item.name || "";
                return { id: String(id), value: String(value) };
            }
            return { id: "", value: "" };
        }).filter(item => item.value !== "");

        console.log(`📊 Standardized HB Attribute Values for ${attributeId} (count: ${formattedData.length}):`, formattedData.slice(0, 5));
        return { success: true, data: formattedData };
    } catch (error: any) {
        return { success: false, message: "Hata: " + error.message };
    }
}

export async function updateHepsiburadaSku(productId: string, hbSku: string, hbMerchantSku?: string) {
    try {
        const updateData: any = {
            hbSku: hbSku || "",
            merchantSku: hbMerchantSku || ""
        };
        const createData: any = {
            productId,
            hbSku: hbSku || "",
            merchantSku: hbMerchantSku || ""
        };
        
        await (prisma as any).hepsiburadaProduct.upsert({
            where: { productId },
            update: updateData,
            create: createData
        });

        // Ürün Hepsiburada ile eşleştirildiğinde, entegrasyon durumunu da otomatik olarak aktif et
        await prisma.product.update({
            where: { id: productId },
            data: { isHepsiburadaActive: true }
        });

        return { success: true, message: "HB SKU güncellendi ve entegrasyon aktif edildi." };
    } catch (error: any) {
        return { success: false, message: "Hata: " + error.message };
    }
}

function getAbsoluteImageUrl(url: string): string {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) {
        return url;
    }
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://serinmotor.com";
    if (baseUrl.endsWith("/")) {
        baseUrl = baseUrl.slice(0, -1);
    }
    const cleanUrl = url.startsWith("/") ? url : `/${url}`;
    let absoluteUrl = `${baseUrl}${cleanUrl}`;
    if (absoluteUrl.startsWith("http://") && !absoluteUrl.includes("localhost")) {
        absoluteUrl = absoluteUrl.replace("http://", "https://");
    }
    return absoluteUrl;
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
                variants: true,
                hepsiburadaProduct: true
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
                merchantSku: (product as any).hepsiburadaProduct?.merchantSku || product.sku || product.barcode || product.id,
                VaryantGroupID: (product as any).hepsiburadaProduct?.merchantSku || product.sku || product.id,
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
                // Görseller - Mutlak HTTPS URL formatına dönüştürüldü
                ...(product.images[0] ? { Image1: getAbsoluteImageUrl(product.images[0]) } : {}),
                ...(product.images[1] ? { Image2: getAbsoluteImageUrl(product.images[1]) } : {}),
                ...(product.images[2] ? { Image3: getAbsoluteImageUrl(product.images[2]) } : {}),
                ...(product.images[3] ? { Image4: getAbsoluteImageUrl(product.images[3]) } : {}),
                ...(product.images[4] ? { Image5: getAbsoluteImageUrl(product.images[4]) } : {}),
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
        // SIT Test Sipariş Oluşturma - stub endpoint (sadece bu POST kabul eder)
        const sitUrl = `https://oms-stub-external-sit.hepsiburada.com/orders/merchantid/${config.merchantId}`;

        // Aktif listing'den gerçek SKU bilgilerini çek
        const client = new HepsiburadaClient({
            username: config.username,
            password: config.password,
            merchantId: config.merchantId || config.username,
            isTestMode: true,
        });

        let testSku = "HBV0000116MZS";
        let testMerchantSku = "DENEME22";
        let testListingId = ""; // Gerçek listing UUID'si
        let testPrice = 485;

        // Aktif listing'den ilk ürünü bul
        try {
            const listingsResponse = await client.getListings(10, 0);
            const listings = listingsResponse?.listings || [];
            const activeProduct = listings.find((l: any) => l.availableStock > 0 && l.price > 0 && l.isSalable);
            if (activeProduct) {
                testSku = activeProduct.hepsiburadaSku;
                testMerchantSku = activeProduct.merchantSku;
                testListingId = activeProduct.listingId; // Gerçek UUID
                testPrice = activeProduct.price;
                console.log(`🛒 Test siparişi için aktif ürün: ${testSku} (${testMerchantSku}) listingId: ${testListingId} - ${testPrice} TL`);
            } else {
                return { success: false, message: "HB'de aktif ve satılabilir listing bulunamadı." };
            }
        } catch (e: any) {
            console.log("⚠️ Listing çekilemedi:", e.message);
            return { success: false, message: "HB Listing çekilemedi: " + e.message };
        }

        const orderId = `HB${Date.now()}`;
        const merchantId = config.merchantId || config.username;

        // HB SIT sipariş - resmi dokümantasyona tam uygun payload
        // https://developers.hepsiburada.com/hepsiburada/reference/post_orders-merchantid-merchantid
        const payload = {
            Customer: {
                CustomerId: "dfc8a27f-faae-4cb2-859c-8a7d50ee77be",
                Name: "Test User"
            },
            DeliveryAddress: {
                AddressDetail: "Trump Towers",
                AddressId: "e66765b3-d37d-488c-ae15-47051245dc9b",
                AlternatePhoneNumber: "045321538212",
                City: "İstanbul",
                CountryCode: "TR",
                District: "Kustepe",
                Email: "customer@hepsiburada.com.tr",
                Name: "Hepsiburada Office",
                PhoneNumber: "902822613231"
            },
            LineItems: [{
                CargoCompanyId: 1,
                DeliveryOptionId: 1,
                ListingId: testListingId,
                MerchantId: merchantId,
                MerchantSku: testMerchantSku,
                Quantity: 1,
                Price: {
                    Amount: testPrice,
                    Currency: "TRY"
                },
                Sku: testSku,
                TotalPrice: {
                    Amount: testPrice,
                    Currency: "TRY"
                }
            }],
            OrderDate: new Date().toISOString(),
            OrderNumber: orderId
        };

        console.log("🛒 SIT Order Payload:", JSON.stringify(payload, null, 2));

        const response = await fetch(sitUrl, {
            method: "POST",
            headers: {
                "Authorization": `Basic ${Buffer.from(`${merchantId}:${config.password}`).toString("base64")}`,
                "Content-Type": "application/json",
                "Accept": "application/json",
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

/**
 * SIT Siparişlerini Listele
 */
export async function getHepsiburadaSitOrders() {
    try {
        const config = await (prisma as any).hepsiburadaConfig.findFirst({ where: { isActive: true, isTestMode: true } });
        if (!config) return { success: false, message: "Aktif SIT bağlantısı bulunamadı.", orders: [] };

        const client = new HepsiburadaClient({
            username: config.username,
            password: config.password,
            merchantId: config.merchantId || config.username,
            isTestMode: true,
        });

        const result = await client.getOrders({ size: 50 });
        const orders = result?.items || result?.content || [];
        
        console.log(`📋 HB SIT Orders: ${orders.length} sipariş bulundu`);
        
        return { 
            success: true, 
            orders: (() => {
                // HB düz dizi döner — her item bir line item. orderNumber ile gruplayalım
                const grouped: Record<string, any> = {};
                for (const item of orders) {
                    const key = item.orderNumber;
                    if (!grouped[key]) {
                        grouped[key] = {
                            orderNumber: item.orderNumber,
                            orderId: item.orderId,
                            status: item.status,
                            orderDate: item.orderDate,
                            lines: []
                        };
                    }
                    grouped[key].lines.push({
                        id: item.id,
                        merchantSku: item.merchantSKU || item.merchantSku,
                        hepsiburadaSku: item.sku,
                        quantity: item.quantity,
                        status: item.status,
                        packageNumber: item.packageNumber || null,
                    });
                }
                return Object.values(grouped);
            })()
        };
    } catch (error: any) {
        console.error("❌ SIT Orders Error:", error);
        return { success: false, message: error.message, orders: [] };
    }
}

/**
 * SIT Siparişi Paketle
 * Adım 2: Siparişteki kalemleri paketler
 */
export async function packageHepsiburadaOrder(orderNumber: string, lineItemIds: string[]) {
    try {
        const config = await (prisma as any).hepsiburadaConfig.findFirst({ where: { isActive: true, isTestMode: true } });
        if (!config) return { success: false, message: "Aktif SIT bağlantısı bulunamadı." };

        const client = new HepsiburadaClient({
            username: config.username,
            password: config.password,
            merchantId: config.merchantId || config.username,
            isTestMode: true,
        });

        console.log(`📦 Paketleme: Order ${orderNumber}, Lines: ${lineItemIds.join(", ")}`);
        
        const result = await client.packageItems(orderNumber, lineItemIds);
        const pkgNumber = result?.packageNumber || result?.id || `PKG-${orderNumber}`;
        console.log("📦 Paketleme Sonucu:", JSON.stringify(result), "PackageNumber:", pkgNumber);
        
        return { success: true, message: `Sipariş paketlendi!`, packageNumber: pkgNumber };
    } catch (error: any) {
        console.error("❌ Paketleme Hatası:", error);
        return { success: false, message: "Paketleme Hatası: " + error.message };
    }
}

/**
 * SIT Fatura Linki Gönder
 * Adım 3: Paketlenmiş siparişe fatura linki iletir
 */
export async function sendHepsiburadaInvoiceLink(packageNumber: string, orderNumber: string, invoiceUrl?: string) {
    try {
        const config = await (prisma as any).hepsiburadaConfig.findFirst({ where: { isActive: true, isTestMode: true } });
        if (!config) return { success: false, message: "Aktif SIT bağlantısı bulunamadı." };

        const client = new HepsiburadaClient({
            username: config.username,
            password: config.password,
            merchantId: config.merchantId || config.username,
            isTestMode: true,
        });

        const fakeInvoiceUrl = invoiceUrl || `https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf`;
        
        console.log(`🧾 Fatura Linki: Package ${packageNumber}, Order ${orderNumber}, URL: ${fakeInvoiceUrl}`);
        
        const result = await client.uploadInvoiceLink(packageNumber, fakeInvoiceUrl, orderNumber);
        console.log("🧾 Fatura Sonucu:", result);
        
        return { success: true, message: `Fatura linki gönderildi! (${packageNumber})` };
    } catch (error: any) {
        console.error("❌ Fatura Hatası:", error);
        return { success: false, message: "Fatura Hatası: " + error.message };
    }
}
