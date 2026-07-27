"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { CiceksepetiClient } from "@/services/ciceksepeti/api";

export async function getCiceksepetiConfig() {
  try {
    const config = await (prisma as any).ciceksepetiConfig.findFirst();
    return config || null;
  } catch (error) {
    console.error("getCiceksepetiConfig error:", error);
    return null;
  }
}

export async function saveCiceksepetiConfig(formData: FormData) {
  try {
    const apiKey = (formData.get("apiKey") as string)?.trim();
    const supplierId = (formData.get("supplierId") as string)?.trim() || null;
    const profitMargin = parseFloat((formData.get("profitMargin") as string) || "0");
    const isActive = formData.get("isActive") === "true";
    const isTestMode = formData.get("isTestMode") === "true";

    if (!apiKey) {
      return { success: false, error: "API Key boş olamaz." };
    }

    const existing = await (prisma as any).ciceksepetiConfig.findFirst();

    if (existing) {
      await (prisma as any).ciceksepetiConfig.update({
        where: { id: existing.id },
        data: {
          apiKey,
          supplierId,
          profitMargin,
          isActive,
          isTestMode,
        },
      });
    } else {
      await (prisma as any).ciceksepetiConfig.create({
        data: {
          apiKey,
          supplierId,
          profitMargin,
          isActive,
          isTestMode,
        },
      });
    }

    revalidatePath("/admin/integrations/ciceksepeti");
    return { success: true, message: "Çiçeksepeti ayarları başarıyla kaydedildi." };
  } catch (error: any) {
    console.error("saveCiceksepetiConfig error:", error);
    return { success: false, error: error.message || "Ayarlar kaydedilirken hata oluştu." };
  }
}

export async function testCiceksepetiConnection(params?: {
  apiKey?: string;
  supplierId?: string;
  isTestMode?: boolean;
}) {
  try {
    if (params?.apiKey) {
      const client = new CiceksepetiClient({
        apiKey: params.apiKey,
        supplierId: params.supplierId || null,
        isActive: true,
        isTestMode: params.isTestMode ?? true,
      });
      return await client.testConnection();
    }

    const client = new CiceksepetiClient();
    return await client.testConnection();
  } catch (error: any) {
    return { success: false, message: error.message || "Bağlantı testi başarısız." };
  }
}

export async function getCiceksepetiCategories() {
  try {
    const client = new CiceksepetiClient();
    return await client.getCategories();
  } catch (error: any) {
    console.error("getCiceksepetiCategories error:", error);
    return [];
  }
}

export async function searchCiceksepetiCategories(query: string) {
  try {
    if (!query || query.trim().length < 2) return [];
    const client = new CiceksepetiClient();
    const categories = await client.getCategories();

    const normalizedQuery = query.toLowerCase().trim();
    const results: { id: string | number; name: string }[] = [];

    const searchRecursive = (catList: any[], parentName = "") => {
      for (const cat of catList) {
        const fullName = parentName ? `${parentName} > ${cat.name}` : cat.name;
        if (cat.name.toLowerCase().includes(normalizedQuery) || fullName.toLowerCase().includes(normalizedQuery)) {
          results.push({ id: cat.id, name: fullName });
        }
        if (cat.subCategories && cat.subCategories.length > 0) {
          searchRecursive(cat.subCategories, fullName);
        }
      }
    };

    searchRecursive(categories);
    return results.slice(0, 50);
  } catch (error) {
    console.error("searchCiceksepetiCategories error:", error);
    return [];
  }
}

export async function syncProductsToCiceksepeti(
  productIds?: string[],
  syncType: "all" | "prices" | "new" = "all"
) {
  try {
    const config = await (prisma as any).ciceksepetiConfig.findFirst({ where: { isActive: true } });
    if (!config) {
      return { success: false, error: "Aktif Çiçeksepeti yapılandırması bulunamadı." };
    }

    const client = new CiceksepetiClient({
      apiKey: config.apiKey,
      supplierId: config.supplierId,
      profitMargin: config.profitMargin || 0,
      isActive: true,
      isTestMode: Boolean(config.isTestMode),
    });

    const whereCondition: any = {
      isActive: true,
      isCiceksepetiActive: true,
    };

    if (productIds && productIds.length > 0) {
      whereCondition.id = { in: productIds };
    }

    const products = await prisma.product.findMany({
      where: whereCondition,
      include: {
        categories: true,
        variants: true,
        ciceksepetiProduct: true,
      },
    });

    if (products.length === 0) {
      return { success: false, error: "Çiçeksepeti için aktif ürün bulunamadı." };
    }

    const profitMargin = config.profitMargin || 0;

    if (syncType === "prices") {
      const priceStockItems: any[] = [];

      for (const p of products) {
        const basePrice = Number(p.ciceksepetiPrice || p.salePrice || p.listPrice);
        const salesPrice = profitMargin > 0 ? Math.round(basePrice * (1 + profitMargin / 100) * 100) / 100 : basePrice;
        const listPrice = Number(p.listPrice) >= salesPrice ? Number(p.listPrice) : salesPrice;

        const validVariants = p.variants?.filter((v) => v.barcode || v.sku) || [];
        if (validVariants.length > 0) {
          for (const v of validVariants) {
            const stockCode = v.barcode || v.sku;
            if (stockCode) {
              priceStockItems.push({
                stockCode,
                salesPrice,
                listPrice,
                stockQuantity: v.stock,
              });
            }
          }
        } else {
          const stockCode = p.barcode || p.sku || p.id;
          if (stockCode) {
            priceStockItems.push({
              stockCode,
              salesPrice,
              listPrice,
              stockQuantity: p.stock,
            });
          }
        }
      }

      if (priceStockItems.length === 0) {
        return { success: false, error: "Güncellenecek fiyat/stok verisi oluşmadı." };
      }

      const result = await client.updatePricesAndStocks(priceStockItems);

      // Ürün durumlarını güncelle
      for (const p of products) {
        await (prisma as any).ciceksepetiProduct.upsert({
          where: { productId: p.id },
          create: {
            productId: p.id,
            barcode: p.barcode,
            batchRequestId: result.batchId,
            batchStatus: result.status || "SUCCESS",
            isSynced: true,
            lastSyncedAt: new Date(),
          },
          update: {
            batchRequestId: result.batchId,
            batchStatus: result.status || "SUCCESS",
            isSynced: true,
            lastSyncError: null,
            lastSyncedAt: new Date(),
          },
        });
      }

      revalidatePath("/admin/integrations/ciceksepeti");
      revalidatePath("/admin/integrations/ciceksepeti/products");
      return {
        success: true,
        message: `${priceStockItems.length} ürün varyasyonunun fiyat/stok bilgisi Çiçeksepeti'ye iletildi. (Batch ID: ${result.batchId})`,
      };
    } else {
      // Full Product Push
      const productInputs: any[] = [];

      for (const p of products) {
        const categoryId = (p as any).ciceksepetiCategoryId || p.categories?.[0]?.ciceksepetiCategoryId || "1";
        const basePrice = Number(p.ciceksepetiPrice || p.salePrice || p.listPrice);
        const salesPrice = profitMargin > 0 ? Math.round(basePrice * (1 + profitMargin / 100) * 100) / 100 : basePrice;
        const listPrice = Number(p.listPrice) >= salesPrice ? Number(p.listPrice) : salesPrice;

        productInputs.push({
          productName: p.name,
          productCode: p.sku || p.barcode || p.id,
          stockCode: p.barcode || p.sku || p.id,
          mainCategoryId: categoryId,
          description: p.marketplaceDescription || p.description || p.name,
          listPrice,
          salesPrice,
          stockQuantity: p.stock,
          barcode: p.barcode || p.sku || p.id,
          images: p.images && p.images.length > 0 ? p.images : ["https://via.placeholder.com/500"],
        });
      }

      const result = await client.createOrUpdateProducts(productInputs);

      for (const p of products) {
        await (prisma as any).ciceksepetiProduct.upsert({
          where: { productId: p.id },
          create: {
            productId: p.id,
            barcode: p.barcode,
            ciceksepetiCode: p.sku || p.barcode,
            batchRequestId: result.batchId,
            batchStatus: result.status || "PENDING",
            isSynced: true,
            lastSyncedAt: new Date(),
          },
          update: {
            batchRequestId: result.batchId,
            batchStatus: result.status || "PENDING",
            isSynced: true,
            lastSyncError: null,
            lastSyncedAt: new Date(),
          },
        });
      }

      revalidatePath("/admin/integrations/ciceksepeti");
      revalidatePath("/admin/integrations/ciceksepeti/products");
      return {
        success: true,
        message: `${productInputs.length} ürün Çiçeksepeti'ye aktarıldı. (Batch ID: ${result.batchId})`,
      };
    }
  } catch (error: any) {
    console.error("syncProductsToCiceksepeti error:", error);
    return { success: false, error: error.message || "Senkronizasyon sırasında hata oluştu." };
  }
}

export async function getCiceksepetiProducts() {
  try {
    const products = await prisma.product.findMany({
      where: { isCiceksepetiActive: true },
      include: {
        ciceksepetiProduct: true,
        categories: { select: { name: true, ciceksepetiCategoryId: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return products;
  } catch (error) {
    console.error("getCiceksepetiProducts error:", error);
    return [];
  }
}

export async function toggleCiceksepetiProductStatus(productId: string, isCiceksepetiActive: boolean) {
  try {
    await prisma.product.update({
      where: { id: productId },
      data: { isCiceksepetiActive },
    });
    revalidatePath("/admin/integrations/ciceksepeti/products");
    revalidatePath("/admin/products");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function syncCiceksepetiOrders() {
  try {
    const client = new CiceksepetiClient();
    const orders = await client.getOrders({ pageSize: 50 });

    let newOrdersCount = 0;

    for (const order of orders) {
      const existing = await (prisma as any).ciceksepetiOrder.findUnique({
        where: { ciceksepetiOrderId: String(order.orderId) },
      });

      if (!existing) {
        await (prisma as any).ciceksepetiOrder.create({
          data: {
            ciceksepetiOrderId: String(order.orderId),
            orderNumber: String(order.orderNumber || order.orderId),
            state: order.orderStatus || "APPROVED",
            rawData: order as any,
          },
        });
        newOrdersCount++;
      }
    }

    revalidatePath("/admin/integrations/ciceksepeti");
    revalidatePath("/admin/orders");

    return {
      success: true,
      message: `${orders.length} sipariş kontrol edildi. ${newOrdersCount} yeni sipariş aktarıldı.`,
    };
  } catch (error: any) {
    console.error("syncCiceksepetiOrders error:", error);
    return { success: false, error: error.message || "Siparişler çekilirken hata oluştu." };
  }
}
