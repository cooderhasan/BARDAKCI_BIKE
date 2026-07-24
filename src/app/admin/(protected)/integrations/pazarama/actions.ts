"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { PazaramaClient } from "@/services/pazarama/api";
import { OrderStatus } from "@prisma/client";
import { handlePostOrderStockSync } from "@/lib/stock-sync";

// ==================== CONFIG ACTIONS ====================

export async function getPazaramaConfig() {
  try {
    const config = await (prisma as any).pazaramaConfig.findFirst();
    return { success: true, data: config };
  } catch (error) {
    return { success: false, error: "Ayarlar alınamadı." };
  }
}

export async function savePazaramaConfig(prevState: any, formData: FormData) {
  try {
    const apiKey = formData.get("apiKey") as string;
    const apiSecret = formData.get("apiSecret") as string;
    const merchantId = (formData.get("merchantId") as string) || "";
    const profitMarginStr = formData.get("profitMargin") as string;
    const profitMargin = profitMarginStr ? parseFloat(profitMarginStr) : 0;
    const isActive = formData.get("isActive") === "on";
    const isTestMode = formData.get("isTestMode") === "on";

    if (!apiKey || !apiSecret) {
      return {
        success: false,
        message: "API Key ve API Secret zorunludur.",
      };
    }

    const existing = await (prisma as any).pazaramaConfig.findFirst();

    if (existing) {
      await (prisma as any).pazaramaConfig.update({
        where: { id: existing.id },
        data: { apiKey, apiSecret, merchantId, profitMargin, isActive, isTestMode },
      });
    } else {
      await (prisma as any).pazaramaConfig.create({
        data: { apiKey, apiSecret, merchantId, profitMargin, isActive, isTestMode },
      });
    }

    try {
      revalidatePath("/admin/integrations/pazarama");
    } catch {}
    return { success: true, message: "Pazarama ayarları başarıyla kaydedildi." };
  } catch (error: any) {
    return { success: false, message: error.message || "Kaydetme hatası." };
  }
}

export async function testPazaramaConnection() {
  try {
    const config = await (prisma as any).pazaramaConfig.findFirst();
    if (!config) {
      return { success: false, message: "Pazarama ayarları bulunamadı." };
    }

    const client = new PazaramaClient(config);
    return await client.testConnection();
  } catch (error: any) {
    return { success: false, message: error.message || "Test sırasında hata oluştu." };
  }
}

import { DEFAULT_PAZARAMA_CATEGORIES } from "@/lib/pazarama-categories-seed";

export async function getPazaramaCategories() {
  try {
    const config = await (prisma as any).pazaramaConfig.findFirst();
    if (!config) {
      return {
        success: true,
        message: "Pazarama API ayarları kaydedilmemiş. Hazır kategori listesi gösteriliyor.",
        data: DEFAULT_PAZARAMA_CATEGORIES
      };
    }

    const client = new PazaramaClient(config);
    const apiCategories = await client.getCategories();
    
    if (apiCategories && apiCategories.length > 0) {
      return { success: true, data: apiCategories };
    }

    return {
      success: true,
      message: "API henüz canlı yanıt vermediği için varsayılan Pazarama kategori ağacı yüklendi.",
      data: DEFAULT_PAZARAMA_CATEGORIES
    };
  } catch (error: any) {
    return {
      success: true,
      message: error.message || "Kategoriler yüklenirken hazır liste kullanıldı.",
      data: DEFAULT_PAZARAMA_CATEGORIES
    };
  }
}

// ==================== PRODUCT ACTIONS ====================

export async function getPazaramaProducts() {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        barcode: true,
        listPrice: true,
        salePrice: true,
        pazaramaPrice: true,
        stock: true,
        images: true,
        isPazaramaActive: true,
        pazaramaStatus: true,
        pazaramaBatchId: true,
        brand: {
          select: { name: true },
        },
        categories: {
          select: {
            pazaramaCategoryId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: products.map((p) => ({
        ...p,
        listPrice: Number(p.listPrice),
        salePrice: p.salePrice ? Number(p.salePrice) : null,
        pazaramaPrice: p.pazaramaPrice ? Number(p.pazaramaPrice) : null,
        pazaramaCategoryId: p.categories.find((c) => c.pazaramaCategoryId)?.pazaramaCategoryId || null,
      })),
    };
  } catch (error) {
    return { success: false, error: "Ürünler çekilemedi." };
  }
}

export async function togglePazaramaProductActive(productId: string, currentState: boolean) {
  try {
    await prisma.product.update({
      where: { id: productId },
      data: { isPazaramaActive: !currentState },
    });

    revalidatePath("/admin/integrations/pazarama/products");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Güncelleme başarısız." };
  }
}

export async function syncProductsToPazarama(
  productIds: string[],
  attributes?: Array<{ attributeId: string; attributeValueId: string }>
) {
  try {
    const config = await (prisma as any).pazaramaConfig.findFirst();
    if (!config || !config.isActive) {
      return { success: false, message: "Pazarama entegrasyonu aktif değil." };
    }

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { brand: true, categories: true },
    });

    if (products.length === 0) {
      return { success: false, message: "Gönderilecek ürün bulunamadı." };
    }

    const client = new PazaramaClient(config);
    const profitMargin = config.profitMargin || 0;

    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.bardakcibike.com.tr";

    const payloadProducts = products.map((p) => {
      const basePrice = Number(p.pazaramaPrice || p.salePrice || p.listPrice);
      const finalPrice = profitMargin > 0 ? basePrice * (1 + profitMargin / 100) : basePrice;
      const catWithPazarama = p.categories.find((c) => c.pazaramaCategoryId) || p.categories[0];

      const formattedImages = (p.images || []).map((img) => {
        if (img.startsWith("http")) return img;
        return `${siteUrl}${img.startsWith("/") ? "" : "/"}${img}`;
      });

      return {
        code: p.sku || p.id,
        title: p.name,
        description: p.marketplaceDescription || p.description || p.name,
        barcode: p.barcode || p.sku || p.id,
        brandId: p.brand?.pazaramaBrandId || undefined,
        categoryId: catWithPazarama?.pazaramaCategoryId || undefined,
        listPrice: Math.round(Number(p.listPrice) * (1 + profitMargin / 100) * 100) / 100,
        salePrice: Math.round(finalPrice * 100) / 100,
        stockQuantity: p.stock,
        vatRate: p.vatRate || 20,
        images: formattedImages,
        attributes: attributes || [],
      };
    });

    const result = await client.createProductBatch(payloadProducts);

    if (result.success) {
      await prisma.product.updateMany({
        where: { id: { in: productIds } },
        data: {
          isPazaramaActive: true,
          pazaramaStatus: "PENDING",
          pazaramaBatchId: result.batchId,
        },
      });

      revalidatePath("/admin/integrations/pazarama/products");
      return {
        success: true,
        message: `${products.length} adet ürün Pazarama'ya başarıyla aktarıldı. Paket ID: ${result.batchId}`,
      };
    } else {
      return { success: false, message: result.error || "Aktarım başarısız oldu." };
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Senkronizasyon hatası." };
  }
}

export async function getPazaramaCategoryAttributes(categoryId: string) {
  try {
    const config = await (prisma as any).pazaramaConfig.findFirst();
    if (!config) {
      return { success: false, message: "Pazarama ayarları bulunamadı." };
    }

    const client = new PazaramaClient(config);
    const attributes = await client.getCategoryAttributes(categoryId);

    return {
      success: true,
      data: attributes,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Attribute çekme hatası." };
  }
}

export async function syncPazaramaStockAndPrice(productIds: string[]) {
  try {
    const config = await (prisma as any).pazaramaConfig.findFirst();
    if (!config || !config.isActive) {
      return { success: false, message: "Pazarama entegrasyonu aktif değil." };
    }

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length === 0) {
      return { success: false, message: "Güncellenecek ürün bulunamadı." };
    }

    const client = new PazaramaClient(config);
    const profitMargin = config.profitMargin || 0;

    const items = products.map((p) => {
      const basePrice = Number(p.pazaramaPrice || p.salePrice || p.listPrice);
      const finalPrice = profitMargin > 0 ? basePrice * (1 + profitMargin / 100) : basePrice;

      return {
        code: p.sku || p.id,
        stock: p.stock,
        price: Math.round(finalPrice * 100) / 100,
      };
    });

    const result = await client.updateStockAndPrice(items);

    if (result.success) {
      revalidatePath("/admin/integrations/pazarama/products");
      return { success: true, message: result.message };
    } else {
      return { success: false, message: result.message };
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Güncelleme hatası." };
  }
}

export async function checkPazaramaBatchStatus(batchId: string) {
  try {
    const config = await (prisma as any).pazaramaConfig.findFirst();
    if (!config || !config.isActive) {
      return { success: false, message: "Pazarama entegrasyonu aktif değil." };
    }

    const client = new PazaramaClient(config);
    const result = await client.getBatchStatus(batchId);
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return { success: false, message: result.error || "Paket durumu çekilemedi." };
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Sorgulama hatası." };
  }
}

export async function getPazaramaOrders(params?: {
  startDate?: string;
  endDate?: string;
  orderNumber?: string;
}) {
  try {
    const config = await (prisma as any).pazaramaConfig.findFirst();
    if (!config || !config.isActive) {
      return { success: false, message: "Pazarama entegrasyonu aktif değil." };
    }

    const client = new PazaramaClient(config);
    const orders = await client.getOrders({
      startDate: params?.startDate,
      endDate: params?.endDate,
      orderNumber: params?.orderNumber ? parseInt(params.orderNumber) : undefined,
    });

    return {
      success: true,
      data: orders,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Sipariş çekme hatası." };
  }
}

function mapPazaramaStatusToOrderStatus(statusStr: string): OrderStatus {
  const s = String(statusStr || "").trim();
  if (s === "3" || s.toLowerCase().includes("alındı") || s.toLowerCase() === "created") return OrderStatus.CONFIRMED;
  if (s === "12" || s.toLowerCase().includes("hazırlanıyor") || s.toLowerCase() === "picking" || s.toLowerCase() === "processing") return OrderStatus.PROCESSING;
  if (s === "5" || s.toLowerCase().includes("kargo") || s.toLowerCase() === "shipped") return OrderStatus.SHIPPED;
  if (s === "11" || s.toLowerCase().includes("teslim") || s.toLowerCase() === "delivered") return OrderStatus.DELIVERED;
  if (s === "6" || s === "13" || s === "14" || s === "7" || s === "8" || s === "10" || s.toLowerCase().includes("iptal") || s.toLowerCase().includes("iade") || s.toLowerCase() === "cancelled") return OrderStatus.CANCELLED;
  return OrderStatus.CONFIRMED;
}

export async function syncOrdersFromPazarama(specificOrderNumber?: string) {
  try {
    const config = await (prisma as any).pazaramaConfig.findFirst({ where: { isActive: true } });
    if (!config) {
      return { success: false, message: "Aktif Pazarama entegrasyonu bulunamadı." };
    }

    const client = new PazaramaClient(config);
    const pazaramaOrders = await client.getOrders(
      specificOrderNumber ? { orderNumber: parseInt(specificOrderNumber) } : undefined
    );

    if (!Array.isArray(pazaramaOrders) || pazaramaOrders.length === 0) {
      return { success: true, message: "Pazarama'da çekilecek yeni sipariş bulunamadı.", count: 0 };
    }

    let importedCount = 0;
    let updatedCount = 0;
    const affectedProductIds: string[] = [];

    for (const pOrder of pazaramaOrders) {
      const orderNum = String(pOrder.orderNumber);

      const existing = await prisma.order.findUnique({
        where: { orderNumber: orderNum },
      });

      const newStatus = mapPazaramaStatusToOrderStatus(pOrder.status);

      if (existing) {
        if (existing.status !== newStatus) {
          await prisma.order.update({
            where: { id: existing.id },
            data: { status: newStatus },
          });
          updatedCount++;
        }
        continue;
      }

      const resolvedItems: any[] = [];
      const stockUpdates: { productId?: string; variantId?: string; quantity: number }[] = [];
      let total = 0;
      let totalVat = 0;

      for (const item of pOrder.items || []) {
        const barcodeOrSku = (item.barcode || item.sku || "").trim();
        let productId: string | null = null;
        let variantId: string | null = null;
        let product: any = null;

        if (barcodeOrSku) {
          const variant = await prisma.productVariant.findFirst({
            where: {
              OR: [{ barcode: barcodeOrSku }, { sku: barcodeOrSku }],
            },
            include: { product: true },
          });

          if (variant) {
            productId = variant.productId;
            variantId = variant.id;
            product = variant.product;
          } else {
            const prd = await prisma.product.findFirst({
              where: {
                OR: [{ barcode: barcodeOrSku }, { sku: barcodeOrSku }],
              },
            });
            if (prd) {
              productId = prd.id;
              product = prd;
            }
          }
        }

        if (!product && item.productName) {
          product = await prisma.product.findFirst({
            where: {
              name: { contains: item.productName, mode: "insensitive" },
            },
          });
          if (product) {
            productId = product.id;
          }
        }

        if (product) {
          const lineUnitPrice = Number(item.price) || 0;
          const lineQty = Number(item.quantity) || 1;
          const lineInvoiceAmount = item.totalAmount != null ? Number(item.totalAmount) : lineUnitPrice * lineQty;
          const vatRate = product.vatRate || 20;
          const lineVat = lineInvoiceAmount - lineInvoiceAmount / (1 + vatRate / 100);

          resolvedItems.push({
            productId: product.id,
            variantId: variantId || undefined,
            productName: item.productName || product.name,
            quantity: lineQty,
            unitPrice: lineUnitPrice,
            lineTotal: lineInvoiceAmount,
            vatRate,
            discountRate: 0,
          });

          total += lineInvoiceAmount;
          totalVat += lineVat;
          stockUpdates.push({ productId: product.id, variantId: variantId || undefined, quantity: lineQty });
          affectedProductIds.push(product.id);
        }
      }

      if (resolvedItems.length > 0) {
        await prisma.$transaction(async (tx) => {
          await tx.order.create({
            data: {
              orderNumber: orderNum,
              source: "PAZARAMA",
              status: newStatus,
              total,
              subtotal: total - totalVat,
              discountAmount: 0,
              appliedDiscountRate: 0,
              vatAmount: totalVat,
              guestEmail: pOrder.customerEmail || `pazarama_${orderNum}@customer.com`,
              shippingAddress: {
                fullName: pOrder.customerName || "Pazarama Müşterisi",
                address: pOrder.deliveryAddress?.address || "",
                city: pOrder.deliveryAddress?.city || "",
                district: pOrder.deliveryAddress?.district || "",
                phone: pOrder.customerPhone || "",
                postalCode: pOrder.deliveryAddress?.postalCode || "",
              },
              items: { create: resolvedItems },
              cargoCompany: (pOrder as any).cargoCompany || (pOrder as any).cargoProviderName || null,
              cargoTrackingNumber: (pOrder as any).cargoTrackingNumber || null,
              shipmentPackageId: pOrder.id || null,
            },
          });

          for (const update of stockUpdates) {
            if (update.variantId) {
              await tx.productVariant.update({
                where: { id: update.variantId },
                data: { stock: { decrement: update.quantity } },
              });
            } else if (update.productId) {
              await tx.product.update({
                where: { id: update.productId },
                data: { stock: { decrement: update.quantity } },
              });
            }
          }
        });

        importedCount++;
      }
    }

    if (affectedProductIds.length > 0) {
      const uniqueIds = Array.from(new Set(affectedProductIds));
      handlePostOrderStockSync(uniqueIds, "site").catch(console.error);
    }

    try {
      revalidatePath("/admin/orders");
      revalidatePath("/admin/integrations/pazarama/orders");
    } catch {}

    return {
      success: true,
      message: `Pazarama siparişleri senkronize edildi. (${importedCount} yeni aktarıldı, ${updatedCount} güncellendi)`,
      count: importedCount,
    };
  } catch (error: any) {
    console.error("syncOrdersFromPazarama error:", error);
    return { success: false, message: error.message || "Pazarama sipariş senkronizasyon hatası." };
  }
}

