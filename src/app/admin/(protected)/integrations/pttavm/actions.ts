"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { PttavmClient, PttavmStockPriceItem, PttavmProductUpsertItem } from "@/services/pttavm/api";

// ==================== CONFIG ACTIONS ====================

export async function getPttavmConfig() {
  try {
    const config = await (prisma as any).pttavmConfig.findFirst();
    return { success: true, data: config };
  } catch (error) {
    return { success: false, error: "Ayarlar alınamadı" };
  }
}

export async function savePttavmConfig(prevState: any, formData: FormData) {
  try {
    const apiKey = (formData.get("apiKey") as string || "").trim();
    const accessToken = (formData.get("accessToken") as string || "").trim();
    const profitMarginStr = formData.get("profitMargin") as string;
    const isActive = formData.get("isActive") === "on";
    const isTestMode = formData.get("isTestMode") === "on";

    const profitMargin = profitMarginStr ? parseFloat(profitMarginStr) : 0;

    if (!apiKey || !accessToken) {
      return {
        success: false,
        message: "API Key ve Access Token zorunludur.",
      };
    }

    const existing = await (prisma as any).pttavmConfig.findFirst();

    if (existing) {
      await (prisma as any).pttavmConfig.update({
        where: { id: existing.id },
        data: { apiKey, accessToken, profitMargin, isActive, isTestMode },
      });
    } else {
      await (prisma as any).pttavmConfig.create({
        data: { apiKey, accessToken, profitMargin, isActive, isTestMode },
      });
    }

    try {
      revalidatePath("/admin/integrations/pttavm");
    } catch {}
    return { success: true, message: "ePttAVM ayarları başarıyla kaydedildi." };
  } catch (error: any) {
    console.error("PttAVM Save Error:", error);
    return { success: false, message: "Kaydetme hatası: " + error.message };
  }
}

export async function testPttavmConnection() {
  try {
    const config = await (prisma as any).pttavmConfig.findFirst();
    if (!config || !config.apiKey || !config.accessToken) {
      return { success: false, message: "ePttAVM API ayarları bulunamadı veya eksik." };
    }

    const client = new PttavmClient({
      apiKey: config.apiKey,
      accessToken: config.accessToken,
      profitMargin: config.profitMargin || 0,
      isTestMode: Boolean(config.isTestMode),
    });

    const result = await client.checkConnection();
    return result;
  } catch (error: any) {
    return { success: false, message: "Sistem Hatası: " + error.message };
  }
}

// ==================== STOK VE FİYAT SENKRONİZASYONU ====================

export async function syncPttavmStockAndPrice(productIds?: string[]) {
  try {
    const config = await (prisma as any).pttavmConfig.findFirst({ where: { isActive: true } });
    if (!config) {
      return { success: false, message: "Aktif ePttAVM entegrasyonu bulunamadı." };
    }

    const client = new PttavmClient({
      apiKey: config.apiKey,
      accessToken: config.accessToken,
      profitMargin: config.profitMargin || 0,
      isTestMode: Boolean(config.isTestMode),
    });

    const where: any = { isActive: true };
    if (productIds && productIds.length > 0) {
      where.id = { in: productIds };
      await prisma.product.updateMany({
        where: { id: { in: productIds } },
        data: { isPttavmActive: true },
      });
    } else {
      where.isPttavmActive = true;
    }

    const products = await prisma.product.findMany({
      where,
      include: { variants: true, pttavmProduct: true },
      take: 200,
    });

    if (products.length === 0) {
      return { success: true, message: "ePttAVM için aktarılacak aktif ürün bulunamadı." };
    }

    const profitMargin = config.profitMargin || 0;
    const items: PttavmStockPriceItem[] = [];

    for (const p of products) {
      const basePrice = Number(p.pttavmPrice || p.salePrice || p.listPrice);
      const finalPriceWithVat = profitMargin > 0 ? basePrice * (1 + profitMargin / 100) : basePrice;
      const vatRate = p.vatRate || 20;
      const priceWithoutVAT = Math.round((finalPriceWithVat / (1 + vatRate / 100)) * 100) / 100;
      const priceWithVAT = Math.round(finalPriceWithVat * 100) / 100;

      const criticalStock = p.criticalStock ?? 0;
      const availableStock = p.stock <= criticalStock ? 0 : Math.max(0, p.stock - criticalStock);

      const validVariants = p.variants?.filter((v: any) => v.barcode) || [];
      if (validVariants.length > 0) {
        for (const v of validVariants) {
          const varAvailableStock = v.stock <= criticalStock ? 0 : Math.max(0, v.stock - criticalStock);
          items.push({
            barcode: v.barcode,
            active: p.isActive && varAvailableStock > 0,
            quantity: varAvailableStock,
            priceWithoutVAT,
            priceWithVAT,
            vatRate,
            discount: 0,
            isCargoFromSupplier: true,
          });
        }
      } else if (p.barcode) {
        items.push({
          barcode: p.barcode,
          active: p.isActive && availableStock > 0,
          quantity: availableStock,
          priceWithoutVAT,
          priceWithVAT,
          vatRate,
          discount: 0,
          isCargoFromSupplier: true,
        });
      }
    }

    if (items.length === 0) {
      return { success: false, message: "Barkodlu ürün bulunamadı." };
    }

    const result = await client.updateStockAndPrice(items);

    for (const p of products) {
      await (prisma as any).pttavmProduct.upsert({
        where: { productId: p.id },
        update: {
          trackingId: result.trackingId || null,
          isSynced: result.success,
          batchStatus: result.success ? "COMPLETED" : "FAILED",
          lastSyncedAt: new Date(),
          lastSyncError: result.message || null,
        },
        create: {
          productId: p.id,
          barcode: p.barcode,
          trackingId: result.trackingId || null,
          isSynced: result.success,
          batchStatus: result.success ? "COMPLETED" : "FAILED",
          lastSyncedAt: new Date(),
        },
      });
    }

    try {
      revalidatePath("/admin/integrations/pttavm");
    } catch {}

    return {
      success: result.success,
      message: result.message || `${items.length} adet ürünün stok/fiyatı ePttAVM'ye iletildi. Tracking ID: ${result.trackingId || "Tamamlandı"}`,
    };
  } catch (error: any) {
    console.error("syncPttavmStockAndPrice Error:", error);
    return { success: false, message: "Hata: " + error.message };
  }
}

// ==================== ÜRÜN EKLEME / GÜNCELLEME (UPSERT) ====================

export async function syncProductsToPttavm(productIds?: string[]) {
  try {
    const config = await (prisma as any).pttavmConfig.findFirst({ where: { isActive: true } });
    if (!config) {
      return { success: false, message: "Aktif ePttAVM entegrasyonu bulunamadı." };
    }

    const client = new PttavmClient({
      apiKey: config.apiKey,
      accessToken: config.accessToken,
      profitMargin: config.profitMargin || 0,
      isTestMode: Boolean(config.isTestMode),
    });

    const where: any = { isActive: true };
    if (productIds && productIds.length > 0) {
      where.id = { in: productIds };
      await prisma.product.updateMany({
        where: { id: { in: productIds } },
        data: { isPttavmActive: true },
      });
    } else {
      await prisma.product.updateMany({
        where: { isActive: true },
        data: { isPttavmActive: true },
      });
      where.isPttavmActive = true;
    }

    const products = await prisma.product.findMany({
      where,
      include: { brand: true, categories: true, variants: true, pttavmProduct: true },
    });

    if (products.length === 0) {
      return { success: true, message: "ePttAVM'ye eklenecek ürün bulunamadı." };
    }

    const profitMargin = config.profitMargin || 0;
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.bardakcibike.com.tr";
    const upsertItems: PttavmProductUpsertItem[] = [];

    for (const p of products) {
      const basePrice = Number(p.pttavmPrice || p.salePrice || p.listPrice);
      const finalPriceWithVat = profitMargin > 0 ? basePrice * (1 + profitMargin / 100) : basePrice;
      const vatRate = p.vatRate || 20;
      const priceWithoutVAT = Math.round((finalPriceWithVat / (1 + vatRate / 100)) * 100) / 100;
      const priceWithVAT = Math.round(finalPriceWithVat * 100) / 100;

      const criticalStock = p.criticalStock ?? 0;
      const availableStock = p.stock <= criticalStock ? 0 : Math.max(0, p.stock - criticalStock);

      const formattedImages = (p.images || []).map((img) =>
        img.startsWith("http") ? img : `${siteUrl}${img.startsWith("/") ? "" : "/"}${img}`
      );

      const catWithPttavm = p.categories.find((c) => c.pttavmCategoryId) || p.categories[0];
      const categoryId = catWithPttavm?.pttavmCategoryId || undefined;
      const brandId = p.brand?.pttavmBrandId || undefined;

      if (p.barcode) {
        upsertItems.push({
          barcode: p.barcode,
          active: p.isActive,
          title: p.name,
          description: p.marketplaceDescription || p.description || p.name,
          categoryId,
          brandId,
          quantity: availableStock,
          priceWithoutVAT,
          priceWithVAT,
          vatRate,
          discount: 0,
          desi: Number(p.desi || 1),
          images: formattedImages,
          isCargoFromSupplier: true,
        });
      }
    }

    if (upsertItems.length === 0) {
      return { success: false, message: "Gönderilecek geçerli barkodlu ürün bulunamadı." };
    }

    const result = await client.upsertProducts(upsertItems);

    for (const p of products) {
      await (prisma as any).pttavmProduct.upsert({
        where: { productId: p.id },
        update: {
          trackingId: result.trackingId || null,
          isSynced: result.success,
          batchStatus: result.success ? "COMPLETED" : "FAILED",
          lastSyncedAt: new Date(),
          lastSyncError: result.message || null,
        },
        create: {
          productId: p.id,
          barcode: p.barcode,
          trackingId: result.trackingId || null,
          isSynced: result.success,
          batchStatus: result.success ? "COMPLETED" : "FAILED",
          lastSyncedAt: new Date(),
        },
      });
    }

    try {
      revalidatePath("/admin/integrations/pttavm");
    } catch {}

    return {
      success: result.success,
      message: result.message || `${upsertItems.length} ürün ePttAVM kataloğuna aktarıldı. Tracking ID: ${result.trackingId || "Tamamlandı"}`,
    };
  } catch (error: any) {
    console.error("syncProductsToPttavm Error:", error);
    return { success: false, message: "Hata: " + error.message };
  }
}

// ==================== SİPARİŞ SENKRONİZASYONU ====================

export async function syncOrdersFromPttavm() {
  try {
    const config = await (prisma as any).pttavmConfig.findFirst({ where: { isActive: true } });
    if (!config) {
      return { success: false, message: "Aktif ePttAVM entegrasyonu bulunamadı." };
    }

    const client = new PttavmClient({
      apiKey: config.apiKey,
      accessToken: config.accessToken,
      profitMargin: config.profitMargin || 0,
      isTestMode: Boolean(config.isTestMode),
    });

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    const res = await client.getOrders({
      startDate: formatDate(thirtyDaysAgo),
      endDate: formatDate(now),
      isActiveOrders: true,
      pageSize: 100,
    });

    const items = res?.items || res?.orders || (Array.isArray(res) ? res : []);
    if (!Array.isArray(items) || items.length === 0) {
      return { success: true, message: "ePttAVM'de yeni sipariş bulunamadı.", count: 0 };
    }

    let savedCount = 0;
    for (const item of items) {
      const pttavmOrderId = String(item.id || item.siparisNo || item.orderId);
      const orderNumber = String(item.siparisNo || item.orderNumber || pttavmOrderId);
      const state = String(item.durum || item.state || "CONFIRMED");

      await (prisma as any).pttavmOrder.upsert({
        where: { pttavmOrderId },
        update: { state, rawData: item, updatedAt: new Date() },
        create: { pttavmOrderId, orderNumber, state, rawData: item },
      });

      if (orderNumber) {
        try {
          const existingOrder = await prisma.order.findUnique({
            where: { orderNumber },
          });

          if (!existingOrder) {
            const customerName = `${item.musteriAdi ?? ""} ${item.musteriSoyadi ?? ""}`.trim() || "ePttAVM Müşterisi";
            const customerEmail = item.musteriEposta || "pttavm@customer.com";
            const customerPhone = item.musteriTelefon || "";

            const orderItemsPayload: any[] = [];
            let subtotal = 0;

            const lineItems = item.siparisUrunler || item.items || [];
            for (const rawItem of lineItems) {
              const barcode = rawItem.barkod || rawItem.barcode;

              let dbProd: any = null;
              if (barcode) {
                dbProd = await prisma.product.findFirst({
                  where: { OR: [{ barcode: String(barcode) }, { sku: String(barcode) }] },
                });
                if (!dbProd) {
                  const variant = await prisma.productVariant.findFirst({
                    where: { OR: [{ barcode: String(barcode) }, { sku: String(barcode) }] },
                    include: { product: true },
                  });
                  if (variant?.product) dbProd = variant.product;
                }
              }

              const itemPrice = Number(rawItem.fiyat ?? rawItem.price ?? 0);
              const qty = Number(rawItem.adet ?? rawItem.quantity ?? 1);
              const lineTotal = itemPrice * qty;
              subtotal += lineTotal;

              if (dbProd) {
                orderItemsPayload.push({
                  productId: dbProd.id,
                  quantity: qty,
                  unitPrice: itemPrice,
                  productName: rawItem.urunAdi || dbProd.name,
                  lineTotal,
                  vatRate: rawItem.kdvOrani ?? 20,
                  discountRate: 0,
                });
              }
            }

            if (orderItemsPayload.length === 0 && lineItems.length > 0) {
              const firstRawItem = lineItems[0];
              const fallbackProd = await prisma.product.findFirst();
              if (fallbackProd) {
                const itemPrice = Number(firstRawItem.fiyat ?? firstRawItem.price ?? 0);
                const qty = Number(firstRawItem.adet ?? firstRawItem.quantity ?? 1);
                orderItemsPayload.push({
                  productId: fallbackProd.id,
                  quantity: qty,
                  unitPrice: itemPrice,
                  productName: firstRawItem.urunAdi || "ePttAVM Ürünü",
                  lineTotal: itemPrice * qty,
                  vatRate: 20,
                  discountRate: 0,
                });
              }
            }

            if (orderItemsPayload.length > 0) {
              const { decrementOrderStock, handlePostOrderStockSync } = await import("@/lib/stock-sync");

              const affectedProductIds = await prisma.$transaction(async (tx) => {
                await tx.order.create({
                  data: {
                    orderNumber,
                    source: "PTTAVM",
                    status: "CONFIRMED",
                    total: Number(item.toplamTutar ?? item.totalPrice ?? subtotal),
                    subtotal,
                    discountAmount: 0,
                    appliedDiscountRate: 0,
                    vatAmount: subtotal * 0.2,
                    guestEmail: customerEmail,
                    shippingAddress: {
                      fullName: customerName,
                      addressText: item.teslimatAdresi || item.adres || "ePttAVM Adresi",
                      city: item.il || "Türkiye",
                      district: item.ilce || "",
                      phone: customerPhone,
                    },
                    items: {
                      create: orderItemsPayload,
                    },
                  },
                });

                return decrementOrderStock(tx, orderItemsPayload.map(i => ({ productId: i.productId, quantity: i.quantity })));
              });

              if (affectedProductIds.length > 0) {
                handlePostOrderStockSync(affectedProductIds, "pttavm").catch(console.error);
              }
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
      revalidatePath("/admin/integrations/pttavm");
    } catch {}

    return {
      success: true,
      message: `${savedCount} ePttAVM siparişi senkronize edildi.`,
      count: savedCount,
    };
  } catch (error: any) {
    console.error("syncOrdersFromPttavm Error:", error);
    return { success: false, message: "Sipariş çekme hatası: " + error.message };
  }
}

// ==================== ÜRÜN LİSTELEME VE TOGGLE ====================

export async function getPttavmProducts({
  page = 1,
  limit = 50,
  search = "",
  store = "ALL",
}: {
  page?: number;
  limit?: number;
  search?: string;
  store?: string;
} = {}) {
  try {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
      ];
    }
    if (store && store !== "ALL") {
      where.store = store;
    }

    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          barcode: true,
          listPrice: true,
          salePrice: true,
          pttavmPrice: true,
          stock: true,
          images: true,
          isPttavmActive: true,
          pttavmProduct: true,
          brand: {
            select: { name: true },
          },
          categories: {
            select: {
              pttavmCategoryId: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      success: true,
      data: products.map((p) => ({
        ...p,
        listPrice: Number(p.listPrice),
        salePrice: p.salePrice ? Number(p.salePrice) : null,
        pttavmPrice: p.pttavmPrice ? Number(p.pttavmPrice) : null,
        pttavmCategoryId: p.categories.find((c) => c.pttavmCategoryId)?.pttavmCategoryId || null,
        pttavmStatus: p.pttavmProduct?.batchStatus || (p.isPttavmActive ? "ACTIVE" : "INACTIVE"),
        trackingId: p.pttavmProduct?.trackingId || null,
      })),
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
      },
    };
  } catch (error) {
    return { success: false, error: "Ürünler çekilemedi." };
  }
}

export async function togglePttavmProductActive(productId: string, currentState: boolean) {
  try {
    await prisma.product.update({
      where: { id: productId },
      data: { isPttavmActive: !currentState },
    });
    revalidatePath("/admin/integrations/pttavm/products");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Güncelleme başarısız." };
  }
}

export async function getPttavmCategories() {
  try {
    const config = await (prisma as any).pttavmConfig.findFirst({ where: { isActive: true } });
    if (!config) return { success: false, data: [] };

    const client = new PttavmClient({
      apiKey: config.apiKey,
      accessToken: config.accessToken,
      profitMargin: config.profitMargin || 0,
      isTestMode: Boolean(config.isTestMode),
    });

    const mainRes = await client.getCategories();
    const mainCats = mainRes?.main_category || [];
    if (!Array.isArray(mainCats) || mainCats.length === 0) {
      return { success: true, data: [] };
    }

    const allTreeCategories: Array<{ id: number; name: string }> = [];

    const flattenTree = (nodes: any[], prefix: string) => {
      if (!Array.isArray(nodes)) return;
      for (const n of nodes) {
        if (!n) continue;
        const catId = Number(n.id);
        const fullName = prefix ? `${prefix} > ${n.name}` : n.name;
        if (catId) {
          allTreeCategories.push({ id: catId, name: fullName });
        }
        if (Array.isArray(n.children) && n.children.length > 0) {
          flattenTree(n.children, fullName);
        }
      }
    };

    // Parallel fetch for main category subtrees
    await Promise.all(
      mainCats.map(async (mc: any) => {
        const mcId = Number(mc.id);
        if (mcId) {
          allTreeCategories.push({ id: mcId, name: mc.name });
          const subRes = await client.request<any>("GET", `/api/v1/categories/category-tree?parentId=${mcId}`).catch(() => null);
          if (subRes && Array.isArray(subRes.category_tree)) {
            flattenTree(subRes.category_tree, mc.name);
          }
        }
      })
    );

    return { success: true, data: allTreeCategories };
  } catch (error: any) {
    console.error("getPttavmCategories error:", error);
    return { success: false, error: error.message };
  }
}


