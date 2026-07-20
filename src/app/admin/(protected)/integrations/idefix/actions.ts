
"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { IdefixClient } from "@/services/idefix/api";

// ==================== CONFIG ====================

export async function getIdefixConfig() {
  try {
    const config = await (prisma as any).idefixConfig.findFirst();
    return { success: true, data: config };
  } catch (error) {
    return { success: false, error: "Ayarlar alinamadi" };
  }
}

export async function saveIdefixConfig(prevState: any, formData: FormData) {
  try {
    const apiKey = formData.get("apiKey") as string;
    const apiSecret = formData.get("apiSecret") as string;
    const vendorId = formData.get("vendorId") as string;
    const isActive = formData.get("isActive") === "on";
    const isTestMode = formData.get("isTestMode") === "on";

    if (!apiKey || !apiSecret || !vendorId) {
      return {
        success: false,
        message: "API Key, API Secret ve Vendor ID zorunludur.",
      };
    }

    const existing = await (prisma as any).idefixConfig.findFirst();

    if (existing) {
      await (prisma as any).idefixConfig.update({
        where: { id: existing.id },
        data: { apiKey, apiSecret, vendorId, isActive, isTestMode },
      });
    } else {
      await (prisma as any).idefixConfig.create({
        data: { apiKey, apiSecret, vendorId, isActive, isTestMode },
      });
    }

    try {
      revalidatePath("/admin/integrations/idefix");
    } catch {}
    return { success: true, message: "Ayarlar basariyla kaydedildi." };
  } catch (error) {
    console.error("Idefix Save Error:", error);
    return { success: false, message: "Kaydetme hatasi." };
  }
}

export async function testIdefixConnection() {
  try {
    const config = await (prisma as any).idefixConfig.findFirst();
    if (!config) return { success: false, message: "Ayarlar bulunamadi." };

    const client = new IdefixClient({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      vendorId: config.vendorId,
      isTestMode: Boolean(config.isTestMode),
    });

    const result = await client.checkConnection();
    return result;
  } catch (error: any) {
    return { success: false, message: "Sistem Hatasi: " + error.message };
  }
}

/** Flatten nested Idefix categories */
function flattenIdefixCategories(nodes: any[], parentPath = ""): Array<{ id: number; name: string }> {
  const result: Array<{ id: number; name: string }> = [];
  for (const node of nodes) {
    const fullPath = parentPath ? `${parentPath} > ${node.name}` : node.name;
    const hasSubs = node.subs && Array.isArray(node.subs) && node.subs.length > 0;
    if (!hasSubs) {
      // Sadece urun eklenebilir en alt (leaf) kategorileri dahil et
      result.push({ id: node.id, name: fullPath });
    } else {
      result.push(...flattenIdefixCategories(node.subs, fullPath));
    }
  }
  return result;
}

export async function getIdefixCategories(): Promise<{ success: boolean; data?: Array<{ id: number; name: string }>; message?: string }> {
  try {
    const config = await (prisma as any).idefixConfig.findFirst();
    if (!config) return { success: false, message: "Idefix entegrasyonu bulunamadi." };

    const client = new IdefixClient({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      vendorId: config.vendorId,
      isTestMode: config.isTestMode ?? false,
    });

    const rawCategories = await client.getCategories();
    if (!Array.isArray(rawCategories)) {
      return { success: false, message: "Kategoriler alinamadi." };
    }

    const flat = flattenIdefixCategories(rawCategories);
    return { success: true, data: flat };
  } catch (error: any) {
    return { success: false, message: "Hata: " + error.message };
  }
}

/**
 * Batch sonucunu Idefix'ten sorgular ve veritabanını günceller.
 */
export async function checkIdefixBatchStatus(productId: string): Promise<{ success: boolean; data?: any; message: string }> {
  try {
    const config = await (prisma as any).idefixConfig.findFirst({ where: { isActive: true } });
    if (!config) return { success: false, message: "Aktif Idefix entegrasyonu bulunamadi." };

    const idefixProd = await (prisma as any).idefixProduct.findUnique({
      where: { productId },
    });

    if (!idefixProd || !idefixProd.batchId) {
      return { success: false, message: "Bu ürün için henüz gönderilmiş bir Batch ID bulunmuyor." };
    }

    const client = new IdefixClient({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      vendorId: config.vendorId,
      isTestMode: Boolean(config.isTestMode),
    });

    let result = await client.getBatchResult(idefixProd.batchId, "fast-listing").catch(() => null);
    if (!result || result.code === 404 || result.status === "NOT_FOUND") {
      result = await client.getBatchResult(idefixProd.batchId, "create").catch(() => null);
    }

    if (!result) {
      return { success: false, message: "Idefix batch sonucu henüz hazır değil veya bulunamadı." };
    }

    const items = result.items || result.products || [];
    const firstItem = items[0] || {};
    const rawErrorCode = firstItem.errorCode || firstItem.failureReason || firstItem.errorReason || firstItem.rejectionReason || firstItem.reason || result.errorMessage || result.message || null;
    const itemStatus = String(firstItem.status || result.batchStatus || result.status || "").toUpperCase();

    const errorTranslations: Record<string, string> = {
      CATEGORY_IS_NOT_LEAF: "Seçtiğiniz Idefix Kategori ID'si bir üst/ana kategoridir. Lütfen Idefix Kategori sayfasından en alt (dal) kategoriyi (Örn: Pedal Grubu) seçin.",
      PRODUCT_BARCODE_NOT_EXIST: "Ürün barkodu Idefix kataloğunda bulunamadı. Lütfen 'Sıfırdan Ürün Oluştur' sekmesini kullanarak Idefix Kategori ve Marka ID ile gönderin.",
      PRODUCT_POOL_ALREADY_EXIST: "Bu ürün Idefix satıcı havuzunuzda zaten tanımlı.",
      VENDOR_CATEGORY_ACCESS_DENIED: "Idefix satıcı hesabınızın bu kategoriye ürün ekleme yetkisi bulunmuyor.",
      VENDOR_ACCESS_DENIED: "Idefix satıcı hesabınız henüz onaylı değil veya yetkiniz kısıtlı.",
      BRAND_EXCLUSIVE_NOT_AUTHORIZED: "Bu markaya ait ürünleri satmak için Idefix yetkiniz bulunmuyor.",
    };

    const resultStr = JSON.stringify(result);
    let matchedReason: string | null = null;
    for (const [code, translation] of Object.entries(errorTranslations)) {
      if (resultStr.includes(code)) {
        matchedReason = translation;
        break;
      }
    }

    const isSuccess = itemStatus === "SUCCESS" || itemStatus === "COMPLETED" || itemStatus === "APPROVED";
    const isDecline = itemStatus === "DECLINE" || itemStatus === "DECLINED" || itemStatus === "FAILED";

    let failureReason = matchedReason || rawErrorCode;
    if (!failureReason && isDecline) {
      failureReason = `Idefix Yanıtı: ${resultStr.slice(0, 250)}`;
    }

    const actualError = isDecline ? (failureReason || "Idefix reddetti") : null;
    const finalBatchStatus = isSuccess ? "COMPLETED" : (isDecline ? "FAILED" : "PENDING");

    await (prisma as any).idefixProduct.update({
      where: { productId },
      data: {
        batchStatus: finalBatchStatus,
        isSynced: isSuccess,
        lastSyncError: actualError,
        lastSyncedAt: new Date(),
      },
    });

    if (actualError) {
      return {
        success: false,
        data: result,
        message: actualError,
      };
    }

    return {
      success: true,
      data: result,
      message: isSuccess ? "Ürün Idefix'te başarıyla onaylandı!" : "Ürün Idefix'e ulaştı, inceleme/onay sürecinde bekleniyor.",
    };
  } catch (error: any) {
    return { success: false, message: "Hata: " + error.message };
  }
}

// ==================== SYNC ====================

import { addMarketplaceSyncJob } from "@/lib/queue/producer";

export async function enqueueIdefixSync() {
  try {
    await addMarketplaceSyncJob({ marketplace: "idefix" as any, type: "products" });
    return {
      success: true,
      message: "Senkronizasyon islemi kuyruga alindi. Arka planda islenecektir.",
    };
  } catch (error: any) {
    return { success: false, message: "Kuyruga eklenirken hata: " + error.message };
  }
}

/**
 * Urunleri Idefix'e gonderir.
 * - Onceden senkronize urunler: inventory (stok/fiyat) guncelle
 * - Yeni urunler: fast-listing (katalogda olanlar icin) ile dene
 * productIds bos ise tum aktif urunler islenir.
 */
export async function syncProductsToIdefix(productIds?: string[]): Promise<{
  success: boolean;
  message: string;
  synced?: number;
  failed?: number;
}> {
  try {
    const config = await (prisma as any).idefixConfig.findFirst({
      where: { isActive: true },
    });
    if (!config) {
      return { success: false, message: "Aktif Idefix entegrasyonu bulunamadi." };
    }

    const client = new IdefixClient({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      vendorId: config.vendorId,
      isTestMode: Boolean(config.isTestMode),
    });

    const isSingleSync = productIds && productIds.length > 0;
    const where: any = { isActive: true };
    if (isSingleSync) {
      where.id = { in: productIds };
      // Otomatik isIdefixActive aktiflestir
      await prisma.product.updateMany({
        where: { id: { in: productIds } },
        data: { isIdefixActive: true },
      });
    } else {
      where.isIdefixActive = true;
    }

    const products = await prisma.product.findMany({
      where,
      include: { brand: true, variants: true, idefixProduct: true },
      take: 50,
    });

    if (products.length === 0) {
      return {
        success: true,
        message: "Idefix'e gonderilecek urun bulunamadi. Urun sayfasindan 'Idefix Aktif' secenegini isaretleyin.",
      };
    }

    // Gruptama: senkronize olmus vs. yeni urunler
    const alreadySyncedProducts: any[] = [];
    const newProducts: any[] = [];

    for (const p of products) {
      if ((p as any).idefixProduct?.isSynced) {
        alreadySyncedProducts.push(p);
      } else {
        newProducts.push(p);
      }
    }

    let totalSynced = 0;
    let totalFailed = 0;

    // --- 1. Onceden senkronize urunler: inventory guncelle ---
    if (alreadySyncedProducts.length > 0) {
      const inventoryItems = alreadySyncedProducts.flatMap((p: any) => {
        const price = Number(p.idefixPrice ?? p.salePrice ?? p.listPrice);
        const rawListPrice = Number(p.listPrice);
        const comparePrice = rawListPrice >= price ? rawListPrice : price;
        const validVariants = p.variants?.filter((v: any) => v.barcode) || [];
        if (validVariants.length > 0) {
          return validVariants.map((v: any) => ({
            barcode: v.barcode,
            price,
            comparePrice,
            inventoryQuantity: v.stock ?? 0,
          }));
        }
        if (p.barcode) {
          return [{
            barcode: p.barcode,
            price,
            comparePrice,
            inventoryQuantity: p.stock ?? 0,
          }];
        }
        return [];
      });

      if (inventoryItems.length > 0) {
        try {
          const result = await client.updateInventory(inventoryItems);
          const batchId = result?.batchRequestId;
          for (const p of alreadySyncedProducts) {
            await (prisma as any).idefixProduct.update({
              where: { productId: p.id },
              data: { batchId, batchStatus: "PENDING", lastSyncedAt: new Date() },
            });
          }
          totalSynced += alreadySyncedProducts.length;
          console.log(`Idefix inventory: ${alreadySyncedProducts.length} urun, batchId=${batchId}`);
        } catch (err: any) {
          console.error("Idefix inventory error:", err.message);
          totalFailed += alreadySyncedProducts.length;
        }
      }
    }

    // --- 2. Yeni urunler: fast-listing ile dene ---
    if (newProducts.length > 0) {
      const fastListingItems = newProducts.flatMap((p: any) => {
        const price = Number(p.idefixPrice ?? p.salePrice ?? p.listPrice);
        const rawListPrice = Number(p.listPrice);
        const comparePrice = rawListPrice >= price ? rawListPrice : price;
        const validVariants = p.variants?.filter((v: any) => v.barcode) || [];
        if (validVariants.length > 0) {
          return validVariants.map((v: any) => ({
            barcode: v.barcode,
            title: p.name + (v.color ? ` - ${v.color}` : "") + (v.size ? ` ${v.size}` : ""),
            vendorStockCode: v.sku || v.barcode,
            price,
            comparePrice,
            inventoryQuantity: v.stock ?? 0,
          }));
        }
        if (p.barcode) {
          return [{
            barcode: p.barcode,
            title: p.name,
            vendorStockCode: p.sku || p.barcode,
            price,
            comparePrice,
            inventoryQuantity: p.stock ?? 0,
          }];
        }
        return [];
      });

      if (fastListingItems.length > 0) {
        const BATCH_SIZE = 50;
        for (let i = 0; i < fastListingItems.length; i += BATCH_SIZE) {
          const batch = fastListingItems.slice(i, i + BATCH_SIZE);
          try {
            const result = await client.quickAddProducts(batch);
            const batchId = result?.batchRequestId;
            for (const p of newProducts) {
              await (prisma as any).idefixProduct.upsert({
                where: { productId: p.id },
                update: { batchId, batchStatus: "PENDING", matchStatus: null, lastSyncedAt: new Date(), lastSyncError: null },
                create: { productId: p.id, batchId, batchStatus: "PENDING", lastSyncedAt: new Date() },
              });
            }
            totalSynced += batch.length;
            console.log(`Idefix fast-listing: ${batch.length} urun, batchId=${batchId}`);
          } catch (err: any) {
            console.error("Idefix fast-listing error:", err.message);
            totalFailed += batch.length;
            for (const p of newProducts) {
              await (prisma as any).idefixProduct.upsert({
                where: { productId: p.id },
                update: { lastSyncError: err.message, batchStatus: "FAILED" },
                create: { productId: p.id, lastSyncError: err.message, batchStatus: "FAILED" },
              });
            }
          }
        }
      }
    }

    const katalogMsg = newProducts.length > 0 ? ` | ${newProducts.length} yeni urun fast-listing` : "";
    const inventoryMsg = alreadySyncedProducts.length > 0 ? ` | ${alreadySyncedProducts.length} urun stok/fiyat guncellendi` : "";

    return {
      success: true,
      message: `Idefix sync: ${totalSynced} basarili, ${totalFailed} basarisiz.${katalogMsg}${inventoryMsg}`,
      synced: totalSynced,
      failed: totalFailed,
    };
  } catch (error: any) {
    console.error("syncProductsToIdefix Error:", error);
    return { success: false, message: "Sync hatasi: " + error.message };
  }
}

export async function getIdefixAddressesAndCargo(): Promise<{
  success: boolean;
  shipmentAddresses?: any[];
  cargoCompanies?: any[];
  message?: string;
}> {
  try {
    const config = await (prisma as any).idefixConfig.findFirst({ where: { isActive: true } });
    if (!config) return { success: false, message: "Aktif Idefix entegrasyonu bulunamadi." };

    const client = new IdefixClient({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      vendorId: config.vendorId,
      isTestMode: config.isTestMode ?? false,
    });

    const [addresses, cargo] = await Promise.all([
      client.getShipmentAddresses().catch(() => []),
      client.getCargoCompanies().catch(() => []),
    ]);

    return {
      success: true,
      shipmentAddresses: Array.isArray(addresses) ? addresses : [],
      cargoCompanies: Array.isArray(cargo) ? cargo : [],
    };
  } catch (error: any) {
    return { success: false, message: "Hata: " + error.message };
  }
}

/**
 * Yeni urun olusturma (create) — Idefix katalogunda bulunmayan urunler icin.
 * Kategori ID ve Marka ID zorunludur.
 */
export async function createProductOnIdefix(productId: string, payload: {
  idefixCategoryId: number | string;
  idefixBrandId: number | string;
  manufacturer?: string;
  importer?: string;
  shipmentAddressId?: number;
  returnAddressId?: number;
  cargoCompanyId?: number;
}): Promise<{ success: boolean; message: string }> {
  try {
    const config = await (prisma as any).idefixConfig.findFirst({ where: { isActive: true } });
    if (!config) return { success: false, message: "Aktif Idefix entegrasyonu bulunamadi." };

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { brand: true, variants: true, categories: true },
    });
    if (!product) return { success: false, message: "Urun bulunamadi." };

    const client = new IdefixClient({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      vendorId: config.vendorId,
      isTestMode: Boolean(config.isTestMode),
    });

    const price = Number((product as any).idefixPrice ?? (product as any).salePrice ?? product.listPrice);
    const rawListPrice = Number(product.listPrice);
    const comparePrice = rawListPrice >= price ? rawListPrice : price;
    const catId = Number(payload.idefixCategoryId);
    const brandId = Number(payload.idefixBrandId);

    // Kategori ve Marka Idefix ID'lerini veritabanında kalıcı olarak kaydet
    if (product.categories && product.categories.length > 0) {
      const firstCatId = product.categories[0].id;
      await prisma.category.update({
        where: { id: firstCatId },
        data: { idefixCategoryId: String(payload.idefixCategoryId) },
      }).catch(() => null);
    }
    if (product.brandId) {
      await prisma.brand.update({
        where: { id: product.brandId },
        data: { idefixBrandId: String(payload.idefixBrandId) },
      }).catch(() => null);
    }

    let shipmentAddressId = payload.shipmentAddressId && Number(payload.shipmentAddressId) > 0 ? Number(payload.shipmentAddressId) : null;
    let returnAddressId = payload.returnAddressId && Number(payload.returnAddressId) > 0 ? Number(payload.returnAddressId) : null;
    let cargoCompanyId = payload.cargoCompanyId && Number(payload.cargoCompanyId) > 0 ? Number(payload.cargoCompanyId) : null;

    if (!shipmentAddressId || !returnAddressId) {
      const addresses = await client.getShipmentAddresses().catch(() => []);
      if (Array.isArray(addresses) && addresses.length > 0) {
        const defaultAddrId = addresses[0]?.id ? Number(addresses[0].id) : null;
        if (!shipmentAddressId) shipmentAddressId = defaultAddrId;
        if (!returnAddressId) returnAddressId = defaultAddrId;
      }
    }

    const manufacturer = payload.manufacturer?.trim() || product.brand?.name || "Bardakçı Bike";
    const importer = payload.importer?.trim() || "Bardakçı Bike";

    const validVariants = product.variants?.filter((v: any) => v.barcode) || [];

    const productsPayload = validVariants.length > 0
      ? validVariants.map((v: any) => ({
          barcode: v.barcode,
          title: product.name + (v.color ? ` - ${v.color}` : "") + (v.size ? ` ${v.size}` : ""),
          productMainId: (product as any).sku || v.barcode,
          brandId: brandId,
          categoryId: catId,
          inventoryQuantity: v.stock ?? 0,
          vendorStockCode: v.sku || v.barcode,
          desi: Number((product as any).desi ?? 0),
          weight: Number((product as any).weight ?? 0),
          description: (product as any).marketplaceDescription || (product as any).description || product.name,
          price,
          comparePrice,
          vatRate: (product as any).vatRate ?? 20,
          deliveryType: "regular",
          cargoCompanyId,
          shipmentAddressId,
          returnAddressId,
          manufacturer,
          importer,
          images: ((product as any).images ?? []).slice(0, 8).map((url: string) => ({ url })),
        }))
      : product.barcode
      ? [{
          barcode: product.barcode,
          title: product.name,
          productMainId: (product as any).sku || product.barcode,
          brandId: brandId,
          categoryId: catId,
          inventoryQuantity: product.stock ?? 0,
          vendorStockCode: (product as any).sku || product.barcode,
          desi: Number((product as any).desi ?? 0),
          weight: Number((product as any).weight ?? 0),
          description: (product as any).marketplaceDescription || (product as any).description || product.name,
          price,
          comparePrice,
          vatRate: (product as any).vatRate ?? 20,
          deliveryType: "regular",
          cargoCompanyId,
          shipmentAddressId,
          returnAddressId,
          manufacturer,
          importer,
          images: ((product as any).images ?? []).slice(0, 8).map((url: string) => ({ url })),
        }]
      : [];

    if (productsPayload.length === 0) {
      return { success: false, message: "Barkodlu varyant bulunamadi." };
    }

    const result = await client.createProducts(productsPayload);
    const batchId = result?.batchRequestId;

    // Otomatik Merchant Onayi (waiting_vendor_approve durumundaki urunleri satici kataloguna tasir)
    const barcodes = productsPayload.map((p: any) => p.barcode).filter(Boolean);
    if (barcodes.length > 0) {
      await client.approveItem(barcodes).catch(() => null);
    }

    await (prisma as any).idefixProduct.upsert({
      where: { productId },
      update: { batchId, batchStatus: "PENDING", lastSyncedAt: new Date(), lastSyncError: null },
      create: { productId, batchId, batchStatus: "PENDING", lastSyncedAt: new Date() },
    });

    try {
      revalidatePath("/admin/integrations/idefix/products");
    } catch {}
    return { success: true, message: `Urun Idefix'e gonderildi ve otomatik onaylandi. Batch ID: ${batchId}` };
  } catch (error: any) {
    return { success: false, message: "Hata: " + error.message };
  }
}

/**
 * Urun Eslestirme Onaylama (Merchant Approve) — Idefix'te waiting_vendor_approve olan urunleri onaylar.
 */
export async function approveIdefixProductMatch(productId: string): Promise<{ success: boolean; message: string }> {
  try {
    const config = await (prisma as any).idefixConfig.findFirst({ where: { isActive: true } });
    if (!config) return { success: false, message: "Aktif Idefix entegrasyonu bulunamadi." };

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { variants: true },
    });
    if (!product) return { success: false, message: "Urun bulunamadi." };

    const validVariants = product.variants?.filter((v: any) => v.barcode) || [];
    const barcodes = validVariants.length > 0
      ? validVariants.map((v: any) => v.barcode)
      : product.barcode
      ? [product.barcode]
      : [];

    if (barcodes.length === 0) {
      return { success: false, message: "Barkod bulunamadi." };
    }

    const client = new IdefixClient({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      vendorId: config.vendorId,
      isTestMode: config.isTestMode ?? false,
    });

    await client.approveItem(barcodes);

    await (prisma as any).idefixProduct.upsert({
      where: { productId },
      update: { isSynced: true, batchStatus: "COMPLETED", lastSyncError: null },
      create: { productId, isSynced: true, batchStatus: "COMPLETED" },
    });

    try {
      revalidatePath("/admin/integrations/idefix/products");
    } catch {}
    return { success: true, message: "Ürün Idefix satıcı kataloğunuzda başarıyla onaylandı ve açıldı!" };
  } catch (error: any) {
    return { success: false, message: "Onaylama hatasi: " + error.message };
  }
}

// ==================== KARGO KODU BILDIRIMI ====================

/**
 * Kargo kodu bildirme — Idefix siparisi kargolandiginda trackingNumber gonderir.
 */
export async function submitIdefixTrackingCode(shipmentId: string, payload: {
  trackingUrl: string;
  trackingNumber: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const config = await (prisma as any).idefixConfig.findFirst({ where: { isActive: true } });
    if (!config) return { success: false, message: "Aktif Idefix entegrasyonu bulunamadi." };

    const client = new IdefixClient({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      vendorId: config.vendorId,
      isTestMode: Boolean(config.isTestMode),
    });

    await client.submitTrackingCode(shipmentId, payload);

    // IdefixOrder tablosunda state'i guncelle
    await (prisma as any).idefixOrder.updateMany({
      where: { idefixOrderId: shipmentId },
      data: { state: "SHIPPED", updatedAt: new Date() },
    });

    try {
      revalidatePath("/admin/integrations/idefix");
    } catch {}
    return { success: true, message: `Kargo kodu '${payload.trackingNumber}' Idefix'e bildirildi.` };
  } catch (error: any) {
    return { success: false, message: "Kargo bildirimi hatasi: " + error.message };
  }
}

// ==================== ORDERS ====================

export async function syncOrdersFromIdefix(specificOrderNumber?: string): Promise<{
  success: boolean;
  message: string;
  count?: number;
}> {
  try {
    const config = await (prisma as any).idefixConfig.findFirst({ where: { isActive: true } });
    if (!config) return { success: false, message: "Aktif Idefix entegrasyonu bulunamadi." };

    const client = new IdefixClient({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      vendorId: config.vendorId,
      isTestMode: Boolean(config.isTestMode),
    });

    let allItems: any[] = [];

    if (specificOrderNumber) {
      const res = await client.getOrders({ orderNumber: specificOrderNumber, limit: 10 });
      allItems = res?.items ?? [];
    } else {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const formatDate = (d: Date) =>
        `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} 00:00:00`;

      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const res = await client.getOrders({
          startDate: formatDate(thirtyDaysAgo),
          endDate: formatDate(now),
          page,
          limit: 100,
        });
        const items = res?.items ?? [];
        allItems.push(...items);
        hasMore = items.length >= 100;
        page++;
      }
    }

    if (allItems.length === 0) {
      return { success: true, message: "Yeni siparis bulunamadi.", count: 0 };
    }

    let savedCount = 0;
    for (const item of allItems) {
      const shipmentId = String(item.id);
      const orderNumber = String(item.orderNumber ?? "");
      const state = String(item.state ?? "UNKNOWN");

      // 1. Raw Idefix Order tablosuna upsert et
      await (prisma as any).idefixOrder.upsert({
        where: { idefixOrderId: shipmentId },
        update: { state, rawData: item, updatedAt: new Date() },
        create: { idefixOrderId: shipmentId, orderNumber, state, rawData: item },
      });

      // 2. Ana Siparisler (prisma.order) tablosuna kaydet (Admin paneli Siparisler ekranında gorunmesi icin)
      if (orderNumber) {
        try {
          const existingOrder = await prisma.order.findUnique({
            where: { orderNumber },
          });

          if (!existingOrder) {
            const shippingAddr = item.shippingAddress || item.invoiceAddress || {};
            const customerName = item.customerContactName || shippingAddr.fullName || `${shippingAddr.firstName ?? ''} ${shippingAddr.lastName ?? ''}`.trim() || "Idefix Müşterisi";
            const customerEmail = item.customerContactMail || "idefix@customer.com";
            const customerPhone = shippingAddr.phone || "";

            const orderItemsPayload: any[] = [];
            let subtotal = 0;

            for (const rawItem of (item.items || [])) {
              const barcode = rawItem.barcode;
              const merchantSku = rawItem.merchantSku;

              let dbProd = null;
              if (barcode) {
                dbProd = await prisma.product.findFirst({
                  where: { OR: [{ barcode: String(barcode) }, { sku: String(barcode) }] },
                });
              }
              if (!dbProd && merchantSku) {
                dbProd = await prisma.product.findFirst({
                  where: { OR: [{ barcode: String(merchantSku) }, { sku: String(merchantSku) }] },
                });
              }

              const itemPrice = Number(rawItem.price ?? rawItem.discountedTotalPrice ?? 0);
              const qty = Number(rawItem.quantity ?? 1);
              const lineTotal = itemPrice * qty;
              subtotal += lineTotal;

              if (dbProd) {
                orderItemsPayload.push({
                  productId: dbProd.id,
                  quantity: qty,
                  unitPrice: itemPrice,
                  productName: rawItem.productName || dbProd.name,
                  lineTotal,
                  vatRate: rawItem.vatRate ?? 20,
                  discountRate: 0,
                });

                // Stok düşür
                await prisma.product.update({
                  where: { id: dbProd.id },
                  data: { stock: { decrement: qty } },
                }).catch(() => null);
              }
            }

            // Eğer ürün barkoddan birebir eşleşemediyse de siparişi kaybetme, ilk ürüne bağla
            if (orderItemsPayload.length === 0 && (item.items || []).length > 0) {
              const firstRawItem = item.items[0];
              const fallbackProd = await prisma.product.findFirst();
              if (fallbackProd) {
                const itemPrice = Number(firstRawItem.price ?? firstRawItem.discountedTotalPrice ?? 0);
                const qty = Number(firstRawItem.quantity ?? 1);
                orderItemsPayload.push({
                  productId: fallbackProd.id,
                  quantity: qty,
                  unitPrice: itemPrice,
                  productName: firstRawItem.productName || "Idefix Ürünü",
                  lineTotal: itemPrice * qty,
                  vatRate: 20,
                  discountRate: 0,
                });
              }
            }

            if (orderItemsPayload.length > 0) {
              await prisma.order.create({
                data: {
                  orderNumber,
                  status: "CONFIRMED",
                  total: Number(item.totalPrice ?? item.discountedTotalPrice ?? subtotal),
                  subtotal,
                  discountAmount: Number(item.totalDiscount ?? 0),
                  appliedDiscountRate: 0,
                  vatAmount: subtotal * 0.2,
                  guestEmail: customerEmail,
                  shippingAddress: {
                    fullName: customerName,
                    addressText: shippingAddr.fullAddress || shippingAddr.address1 || "Idefix Adresi",
                    city: shippingAddr.city || "Türkiye",
                    district: shippingAddr.county || "",
                    phone: customerPhone,
                  },
                  items: {
                    create: orderItemsPayload,
                  },
                },
              });
            }
          }
        } catch (err: any) {
          console.error(`prisma.order create error (${orderNumber}):`, err.message);
        }
      }

      savedCount++;
    }

    try {
      revalidatePath("/admin/orders");
      revalidatePath("/admin/integrations/idefix");
    } catch {}

    return {
      success: true,
      message: `${savedCount} Idefix siparisi senkronize edildi ve Siparisler sayfasina aktarildi.`,
      count: savedCount,
    };
  } catch (error: any) {
    console.error("syncOrdersFromIdefix Error:", error);
    return { success: false, message: "Siparis sync hatasi: " + error.message };
  }
}

export async function getIdefixOrders(page = 1, limit = 20) {
  try {
    const orders = await (prisma as any).idefixOrder.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });
    const total = await (prisma as any).idefixOrder.count();
    return { success: true, data: orders, total };
  } catch (error) {
    return { success: false, error: "Siparisler alinamadi", data: [], total: 0 };
  }
}

export async function getIdefixProducts() {
  try {
    const products = await prisma.product.findMany({
      include: { brand: true, categories: true, idefixProduct: true, variants: true },
      orderBy: { updatedAt: "desc" },
    });
    return { success: true, data: products };
  } catch (error) {
    return { success: false, error: "Urunler alinamadi", data: [] };
  }
}

export async function toggleIdefixProductActive(productId: string, isActive: boolean) {
  try {
    await prisma.product.update({
      where: { id: productId },
      data: { isIdefixActive: isActive },
    });
    try {
      revalidatePath("/admin/integrations/idefix/products");
    } catch {}
    return { success: true };
  } catch (error) {
    return { success: false, error: "Guncelleme basarisiz" };
  }
}
