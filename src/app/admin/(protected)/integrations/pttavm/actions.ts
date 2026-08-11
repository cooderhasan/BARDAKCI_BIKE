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

    const resActive = await client.getOrders({
      startDate: formatDate(thirtyDaysAgo),
      endDate: formatDate(now),
      isActiveOrders: false,
      pageSize: 100,
    }).catch(() => null);

    const items = Array.isArray(resActive) ? resActive : (resActive?.items || resActive?.orders || []);

    if (!Array.isArray(items) || items.length === 0) {
      return { success: true, message: "ePttAVM'de yeni sipariş bulunamadı.", count: 0 };
    }

    let savedCount = 0;
    for (const item of items) {
      const pttavmOrderId = String(item.id || item.siparisNo || item.orderId || "");
      const orderNumber = String(item.siparisNo || item.orderNumber || pttavmOrderId);
      const state = String(item.durum || item.state || "CONFIRMED");

      await (prisma as any).pttavmOrder.upsert({
        where: { pttavmOrderId },
        update: { state, rawData: item, updatedAt: new Date() },
        create: { pttavmOrderId, orderNumber, state, rawData: item },
      });

      if (!orderNumber) continue;

      try {
        const customerFirstName = String(item.musteriAdi || "").trim();
        const customerLastName = String(item.musteriSoyadi || "").trim();
        const customerName = `${customerFirstName} ${customerLastName}`.trim() || "ePttAVM Müşterisi";
        const customerEmail = String(item.eposta || item.musteriEposta || item.email || "pttavm@customer.com").trim();
        const customerPhone = String(item.telefonNo || item.musteriTelefon || item.phone || "").trim();

        const invoiceName = `${item.faturaMusteriAdi || customerFirstName} ${item.faturaMusteriSoyadi || customerLastName}`.trim() || customerName;
        const shippingAddressObj = {
          fullName: customerName,
          addressText: String(item.siparisAdresi || item.teslimatAdresi || item.adres || "ePttAVM Adresi").trim(),
          city: String(item.siparisIli || item.il || "Türkiye").trim(),
          district: String(item.siparisIlce || item.ilce || "").trim(),
          phone: customerPhone,
          billingFullName: invoiceName,
          billingAddressText: String(item.faturaAdresi || item.siparisAdresi || item.adres || "ePttAVM Adresi").trim(),
          billingCity: String(item.faturaIli || item.siparisIli || item.il || "Türkiye").trim(),
          billingDistrict: String(item.faturaIlce || item.siparisIlce || item.ilce || "").trim(),
          taxOffice: String(item.vergiDaire || "").trim(),
          taxNumber: String(item.vergiNo || item.tckn || "").trim(),
          companyName: String(item.firmaUnvani || "").trim(),
        };

        const lineItems = Array.isArray(item.siparisUrunler) && item.siparisUrunler.length > 0
          ? item.siparisUrunler
          : (Array.isArray(item.items) ? item.items : [item]);

        const orderItemsPayload: any[] = [];
        let totalNetOrderAmount = 0;

        for (const rawItem of lineItems) {
          const rawTitle = String(rawItem.urun || rawItem.urunAdi || item.urunAdi || "ePttAVM Ürünü").trim();
          const barcode = String(rawItem.urunBarkod || rawItem.variantBarkod || rawItem.barkod || rawItem.barcode || item.urunKodu || "").trim();
          const qty = Math.max(1, Number(rawItem.toplamIslemAdedi || rawItem.adet || rawItem.quantity || 1));
          
          let grossTotal = Number(rawItem.kdvDahilToplamTutar || 0);
          let discountTotal = Number(rawItem.indirimToplam || 0);
          let netTotal = grossTotal > 0 ? (grossTotal - discountTotal) : Number(rawItem.fiyat || rawItem.price || item.fiyat || 0) * qty;

          if (netTotal <= 0 && lineItems.length === 1 && Number(item.toplamTutar || item.totalPrice || 0) > 0) {
            netTotal = Number(item.toplamTutar || item.totalPrice);
          }

          const unitPrice = Math.round((netTotal / qty) * 100) / 100;
          totalNetOrderAmount += netTotal;

          let dbProd: any = null;

          // 1. Exact match on barcode or sku
          if (barcode) {
            dbProd = await prisma.product.findFirst({
              where: { OR: [{ barcode }, { sku: barcode }] },
            });
            if (!dbProd) {
              const variant = await prisma.productVariant.findFirst({
                where: { OR: [{ barcode }, { sku: barcode }] },
                include: { product: true },
              });
              if (variant?.product) dbProd = variant.product;
            }
          }

          // 2. Prefix match if barcode contains "-" (e.g. "s3733-187" -> prefix "s3733")
          if (!dbProd && barcode.includes("-")) {
            const prefix = barcode.split("-")[0].trim();
            if (prefix.length >= 2) {
              dbProd = await prisma.product.findFirst({
                where: { OR: [{ sku: { equals: prefix, mode: "insensitive" } }, { barcode: { equals: prefix, mode: "insensitive" } }] },
              });
              if (!dbProd) {
                const variant = await prisma.productVariant.findFirst({
                  where: { OR: [{ sku: { equals: prefix, mode: "insensitive" } }, { barcode: { equals: prefix, mode: "insensitive" } }] },
                  include: { product: true },
                });
                if (variant?.product) dbProd = variant.product;
              }
            }
          }

          // 3. Title match fallback
          if (!dbProd && rawTitle && rawTitle !== "ePttAVM Ürünü") {
            const firstWord = rawTitle.split(" ")[0];
            if (firstWord.length >= 3) {
              dbProd = await prisma.product.findFirst({
                where: { name: { contains: firstWord, mode: "insensitive" } },
              });
            }
          }

          // 4. Fallback product
          if (!dbProd) {
            dbProd = await prisma.product.findFirst();
          }

          if (dbProd) {
            orderItemsPayload.push({
              productId: dbProd.id,
              quantity: qty,
              unitPrice: unitPrice,
              productName: rawTitle !== "ePttAVM Ürünü" ? rawTitle : dbProd.name,
              lineTotal: netTotal,
              vatRate: Number(rawItem.kdvOrani || 20),
              discountRate: 0,
            });
          }
        }

        if (orderItemsPayload.length > 0) {
          const finalTotal = totalNetOrderAmount > 0 ? totalNetOrderAmount : Number(item.toplamTutar || item.totalPrice || 0);
          const existingOrder = await prisma.order.findUnique({
            where: { orderNumber },
            include: { items: true },
          });

          if (!existingOrder) {
            const { decrementOrderStock, handlePostOrderStockSync } = await import("@/lib/stock-sync");

            const affectedProductIds = await prisma.$transaction(async (tx) => {
              await tx.order.create({
                data: {
                  orderNumber,
                  source: "PTTAVM",
                  status: "CONFIRMED",
                  total: finalTotal,
                  subtotal: finalTotal,
                  discountAmount: 0,
                  appliedDiscountRate: 0,
                  vatAmount: Math.round(finalTotal * 0.2 * 100) / 100,
                  guestEmail: customerEmail,
                  shippingAddress: shippingAddressObj,
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
          } else {
            // Update existing incomplete order (fix email, phone, address, prices, titles if they were 0 or ePttAVM Ürünü)
            const hasIncompleteItems = existingOrder.items.some(i => i.productName === "ePttAVM Ürünü" || Number(i.unitPrice) === 0);
            if (hasIncompleteItems || existingOrder.guestEmail === "pttavm@customer.com" || (existingOrder.shippingAddress as any)?.city === "Türkiye") {
              await prisma.$transaction(async (tx) => {
                await tx.orderItem.deleteMany({ where: { orderId: existingOrder.id } });
                await tx.order.update({
                  where: { id: existingOrder.id },
                  data: {
                    total: finalTotal,
                    subtotal: finalTotal,
                    vatAmount: Math.round(finalTotal * 0.2 * 100) / 100,
                    guestEmail: customerEmail,
                    shippingAddress: shippingAddressObj,
                    items: {
                      create: orderItemsPayload,
                    },
                  },
                });
              });
            }
          }
        }
      } catch (err: any) {
        console.error(`prisma.order sync error (${orderNumber}):`, err.message);
      }

      savedCount++;
    }

    try {
      revalidatePath("/admin/orders");
      revalidatePath("/admin/integrations/pttavm");
    } catch {}

    return {
      success: true,
      message: `${savedCount} adet ePttAVM siparişi kontrol edildi ve aktarıldı.`,
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


