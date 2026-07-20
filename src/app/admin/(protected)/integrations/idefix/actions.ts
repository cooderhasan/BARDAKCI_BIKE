
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

    revalidatePath("/admin/integrations/idefix");
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
      isTestMode: config.isTestMode ?? true,
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
    result.push({ id: node.id, name: fullPath });
    if (node.subs && Array.isArray(node.subs) && node.subs.length > 0) {
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
      isTestMode: config.isTestMode ?? true,
    });

    const where: any = { isIdefixActive: true, isActive: true };
    if (productIds && productIds.length > 0) {
      where.id = { in: productIds };
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
        const listPrice = Number(p.listPrice);
        return p.variants
          .filter((v: any) => v.barcode)
          .map((v: any) => ({
            barcode: v.barcode,
            salePrice: price,
            listPrice,
            quantity: v.stock ?? 0,
          }));
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
        const comparePrice = Number(p.listPrice);
        return p.variants
          .filter((v: any) => v.barcode)
          .map((v: any) => ({
            barcode: v.barcode,
            title: p.name + (v.color ? ` - ${v.color}` : "") + (v.size ? ` ${v.size}` : ""),
            vendorStockCode: v.sku || v.barcode,
            price,
            comparePrice,
            inventoryQuantity: v.stock ?? 0,
          }));
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

/**
 * Yeni urun olusturma (create) — Idefix katalogunda bulunmayan urunler icin.
 * Kategori ID ve Marka ID zorunludur.
 */
export async function createProductOnIdefix(productId: string, payload: {
  idefixCategoryId: number;
  idefixBrandId: number;
  shipmentAddressId?: number;
  returnAddressId?: number;
  cargoCompanyId?: number;
}): Promise<{ success: boolean; message: string }> {
  try {
    const config = await (prisma as any).idefixConfig.findFirst({ where: { isActive: true } });
    if (!config) return { success: false, message: "Aktif Idefix entegrasyonu bulunamadi." };

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { brand: true, variants: true },
    });
    if (!product) return { success: false, message: "Urun bulunamadi." };

    const client = new IdefixClient({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      vendorId: config.vendorId,
      isTestMode: config.isTestMode ?? true,
    });

    const price = Number((product as any).idefixPrice ?? (product as any).salePrice ?? product.listPrice);

    const productsPayload = product.variants
      .filter((v: any) => v.barcode)
      .map((v: any) => ({
        barcode: v.barcode,
        title: product.name + (v.color ? ` - ${v.color}` : "") + (v.size ? ` ${v.size}` : ""),
        productMainId: (product as any).sku || v.barcode,
        brandId: payload.idefixBrandId,
        categoryId: payload.idefixCategoryId,
        inventoryQuantity: v.stock ?? 0,
        vendorStockCode: v.sku || v.barcode,
        desi: Number((product as any).desi ?? 0),
        weight: Number((product as any).weight ?? 0),
        description: (product as any).marketplaceDescription || (product as any).description || product.name,
        price,
        comparePrice: Number(product.listPrice),
        vatRate: (product as any).vatRate ?? 20,
        deliveryType: "regular",
        cargoCompanyId: payload.cargoCompanyId ?? 0,
        shipmentAddressId: payload.shipmentAddressId ?? 0,
        returnAddressId: payload.returnAddressId ?? 0,
        images: ((product as any).images ?? []).slice(0, 8).map((url: string) => ({ url })),
      }));

    if (productsPayload.length === 0) {
      return { success: false, message: "Barkodlu varyant bulunamadi." };
    }

    const result = await client.createProducts(productsPayload);
    const batchId = result?.batchRequestId;

    await (prisma as any).idefixProduct.upsert({
      where: { productId },
      update: { batchId, batchStatus: "PENDING", lastSyncedAt: new Date(), lastSyncError: null },
      create: { productId, batchId, batchStatus: "PENDING", lastSyncedAt: new Date() },
    });

    revalidatePath("/admin/integrations/idefix/products");
    return { success: true, message: `Urun Idefix'e gonderildi. Batch ID: ${batchId}` };
  } catch (error: any) {
    return { success: false, message: "Hata: " + error.message };
  }
}

// ==================== KARGO KODU BILDIRIMI ====================

/**
 * Kargo kodu bildirme — Idefix siparisi kargolandiginda trackingNumber gonderir.
 */
export async function submitIdefixTrackingCode(shipmentId: string, payload: {
  cargoCompany: string;
  trackingNumber: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const config = await (prisma as any).idefixConfig.findFirst({ where: { isActive: true } });
    if (!config) return { success: false, message: "Aktif Idefix entegrasyonu bulunamadi." };

    const client = new IdefixClient({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      vendorId: config.vendorId,
      isTestMode: config.isTestMode ?? true,
    });

    await client.submitTrackingCode(shipmentId, payload);

    // IdefixOrder tablosunda state'i guncelle
    await (prisma as any).idefixOrder.updateMany({
      where: { idefixOrderId: shipmentId },
      data: { state: "SHIPPED", updatedAt: new Date() },
    });

    revalidatePath("/admin/integrations/idefix");
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
      isTestMode: config.isTestMode ?? true,
    });

    let allItems: any[] = [];

    if (specificOrderNumber) {
      const res = await client.getOrders({ orderNumber: specificOrderNumber, limit: 10 });
      allItems = res?.items ?? [];
    } else {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const formatDate = (d: Date) =>
        `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} 00:00:00`;

      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const res = await client.getOrders({
          startDate: formatDate(twoDaysAgo),
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

      await (prisma as any).idefixOrder.upsert({
        where: { idefixOrderId: shipmentId },
        update: { state, rawData: item, updatedAt: new Date() },
        create: { idefixOrderId: shipmentId, orderNumber, state, rawData: item },
      });
      savedCount++;
    }

    return {
      success: true,
      message: `${savedCount} Idefix siparisi senkronize edildi.`,
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
    revalidatePath("/admin/integrations/idefix/products");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Guncelleme basarisiz" };
  }
}
