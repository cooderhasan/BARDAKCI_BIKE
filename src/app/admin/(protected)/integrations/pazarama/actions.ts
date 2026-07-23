"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { PazaramaClient } from "@/services/pazarama/api";

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

export async function syncProductsToPazarama(productIds: string[]) {
  try {
    const config = await (prisma as any).pazaramaConfig.findFirst();
    if (!config || !config.isActive) {
      return { success: false, message: "Pazarama entegrasyonu aktif değil." };
    }

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { brand: true, category: true },
    });

    if (products.length === 0) {
      return { success: false, message: "Gönderilecek ürün bulunamadı." };
    }

    const client = new PazaramaClient(config);
    const profitMargin = config.profitMargin || 0;

    const payloadProducts = products.map((p) => {
      const basePrice = Number(p.pazaramaPrice || p.salePrice || p.listPrice);
      const finalPrice = profitMargin > 0 ? basePrice * (1 + profitMargin / 100) : basePrice;

      return {
        code: p.sku || p.id,
        title: p.name,
        description: p.marketplaceDescription || p.description || p.name,
        barcode: p.barcode || p.sku || p.id,
        brandId: p.brand?.pazaramaBrandId || undefined,
        categoryId: p.category?.pazaramaCategoryId || undefined,
        listPrice: Math.round(Number(p.listPrice) * (1 + profitMargin / 100) * 100) / 100,
        salePrice: Math.round(finalPrice * 100) / 100,
        stockQuantity: p.stock,
        vatRate: p.vatRate || 20,
        images: p.images || [],
      };
    });

    const result = await client.createProductBatch(payloadProducts);

    if (result.success) {
      // Update pazaramaBatchId and status on products
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
