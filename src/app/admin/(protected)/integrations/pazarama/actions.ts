"use server";
import { requireAdmin } from "@/lib/admin-guard";

import { prisma } from "@/lib/db";
import { safeRevalidatePath as revalidatePath } from "@/lib/safe-revalidate";
import { isListingLive, formatListingReport } from "@/lib/marketplace-report";
import { PazaramaClient } from "@/services/pazarama/api";
import { OrderStatus } from "@prisma/client";
import { handlePostOrderStockSync } from "@/lib/stock-sync";

// ==================== CONFIG ACTIONS ====================

export async function getPazaramaConfig() {
  await requireAdmin();
  try {
    const config = await (prisma as any).pazaramaConfig.findFirst();
    return { success: true, data: config };
  } catch (error) {
    return { success: false, error: "Ayarlar alınamadı." };
  }
}

export async function savePazaramaConfig(prevState: any, formData: FormData) {
  await requireAdmin();
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
  await requireAdmin();
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

// Pazarama kategori/marka listeleri API'den çekilip 24 saat SiteSettings'te saklanır (her aramada büyük liste çekilmesin).
const PAZARAMA_LIST_TTL_MS = 24 * 60 * 60 * 1000;

async function getCachedPazaramaList(
  key: string,
  fetchLive: (client: PazaramaClient) => Promise<Array<{ id: string; name: string }>>,
  isValid: (items: any[]) => boolean,
): Promise<{ items: Array<{ id: string; name: string }>; source: string; error?: string }> {
  const saved = await prisma.siteSettings.findUnique({ where: { key } });
  const value: any = saved?.value;
  const cached: any[] = Array.isArray(value?.items) ? value.items : [];
  const cacheUsable = cached.length > 0 && isValid(cached);
  const fresh = value?.updatedAt && Date.now() - new Date(value.updatedAt).getTime() < PAZARAMA_LIST_TTL_MS;
  if (cacheUsable && fresh) return { items: cached, source: "database" };

  try {
    const config = await (prisma as any).pazaramaConfig.findFirst({ where: { isActive: true } });
    if (!config) throw new Error("Aktif Pazarama entegrasyonu bulunamadı.");
    const live = await fetchLive(new PazaramaClient(config));
    if (live.length > 0) {
      const stored = { items: live, updatedAt: new Date().toISOString() };
      await prisma.siteSettings.upsert({ where: { key }, create: { key, value: stored }, update: { value: stored } });
      return { items: live, source: "api" };
    }
    throw new Error("Pazarama boş liste döndürdü.");
  } catch (e: any) {
    if (cacheUsable) return { items: cached, source: "database", error: e?.message };
    return { items: [], source: "none", error: e?.message };
  }
}

export async function getPazaramaCategories() {
  await requireAdmin();
  // Eski sürümdeki uydurma "paz-cat-*" kodları Pazarama'da yok; böyle bir liste kayıtlıysa geçersiz sayılır
  const res = await getCachedPazaramaList(
    "pazarama_categories",
    (client) => client.getCategories(),
    (items) => !items.some((c: any) => String(c?.id || "").startsWith("paz-cat-")),
  );
  if (res.items.length === 0) {
    return { success: false, data: [], source: res.source, message: `Pazarama kategori listesi alınamadı: ${res.error || "bilinmeyen hata"}` };
  }
  return { success: true, data: res.items, source: res.source };
}

export async function getPazaramaBrands() {
  await requireAdmin();
  // Eski sürüm sayfa boyutu vermediği için sadece 10 marka kaydediyordu; bu kadar az kayıt geçersiz sayılır
  const res = await getCachedPazaramaList("pazarama_brands", (client) => client.getBrands(), (items) => items.length > 10);
  if (res.items.length === 0) {
    return { success: false, data: [], message: `Pazarama marka listesi alınamadı: ${res.error || "bilinmeyen hata"}` };
  }
  return { success: true, data: res.items, source: res.source };
}

/**
 * Pazarama Kategori Listesini Metin/Excel/JSON Şeklinde Toplu Kaydeder.
 * Kullanıcı https://isortagim.pazarama.com/auth/integration/kategori-listesi sayfasından
 * kopyaladığı veriyi yapıştırdığında çalışır.
 */
export async function savePazaramaCategoriesBulk(rawInput: string) {
  await requireAdmin();
  try {
    if (!rawInput || !rawInput.trim()) {
      return { success: false, message: "Lütfen yapıştırılacak veri giriniz." };
    }

    const items: Array<{ id: string; name: string }> = [];

    // JSON formatında mı?
    if (rawInput.trim().startsWith("[") || rawInput.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(rawInput);
        const arr = Array.isArray(parsed) ? parsed : parsed.categories || parsed.data || [];
        for (const item of arr) {
          const id = String(item.id || item.categoryId || item.code || "").trim();
          const name = String(item.name || item.categoryName || item.title || "").trim();
          if (id && name) {
            items.push({ id, name });
          }
        }
      } catch (e) {}
    }

    // Satır satır ayrıştırma (Excel Tab / Noktalı virgül / Virgül)
    if (items.length === 0) {
      const lines = rawInput.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let parts = trimmed.split("\t");
        if (parts.length < 2) parts = trimmed.split(";");
        if (parts.length < 2) parts = trimmed.split(",");

        if (parts.length >= 2) {
          const p1 = parts[0].trim();
          const p2 = parts[1].trim();

          const isGuidP1 = /^[a-zA-Z0-9-]{8,}$/.test(p1) && /\d/.test(p1);
          const isGuidP2 = /^[a-zA-Z0-9-]{8,}$/.test(p2) && /\d/.test(p2);

          if (isGuidP1) {
            items.push({ id: p1, name: p2 });
          } else if (isGuidP2) {
            items.push({ id: p2, name: p1 });
          } else {
            items.push({ id: p1, name: p2 });
          }
        }
      }
    }

    if (items.length === 0) {
      return {
        success: false,
        message:
          "Geçerli bir kategori ID ve adı eşleşmesi bulunamadı. Lütfen 'ID [Sekme] Kategori Adı' veya Excel tablosu formatında yapıştırınız.",
      };
    }

    await prisma.siteSettings.upsert({
      where: { key: "pazarama_categories" },
      create: { key: "pazarama_categories", value: { items, updatedAt: new Date().toISOString() } },
      update: { value: { items, updatedAt: new Date().toISOString() } },
    });

    try {
      revalidatePath("/admin/categories");
    } catch {}

    return {
      success: true,
      message: `Başarılı! ${items.length} adet Pazarama kategorisi veritabanına kaydedildi.`,
      count: items.length,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Kaydetme hatası." };
  }
}

/**
 * Pazarama Marka Listesini Metin/Excel/JSON Şeklinde Toplu Kaydeder.
 */
export async function savePazaramaBrandsBulk(rawInput: string) {
  await requireAdmin();
  try {
    if (!rawInput || !rawInput.trim()) {
      return { success: false, message: "Lütfen yapıştırılacak veri giriniz." };
    }

    const items: Array<{ id: string; name: string }> = [];

    if (rawInput.trim().startsWith("[") || rawInput.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(rawInput);
        const arr = Array.isArray(parsed) ? parsed : parsed.brands || parsed.data || [];
        for (const item of arr) {
          const id = String(item.id || item.brandId || item.code || "").trim();
          const name = String(item.name || item.brandName || item.title || "").trim();
          if (id && name) {
            items.push({ id, name });
          }
        }
      } catch (e) {}
    }

    if (items.length === 0) {
      const lines = rawInput.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let parts = trimmed.split("\t");
        if (parts.length < 2) parts = trimmed.split(";");
        if (parts.length < 2) parts = trimmed.split(",");

        if (parts.length >= 2) {
          const p1 = parts[0].trim();
          const p2 = parts[1].trim();

          const isGuidP1 = /^[a-zA-Z0-9-]{4,}$/.test(p1) && /\d/.test(p1);
          const isGuidP2 = /^[a-zA-Z0-9-]{4,}$/.test(p2) && /\d/.test(p2);

          if (isGuidP1) {
            items.push({ id: p1, name: p2 });
          } else if (isGuidP2) {
            items.push({ id: p2, name: p1 });
          } else {
            items.push({ id: p1, name: p2 });
          }
        }
      }
    }

    if (items.length === 0) {
      return {
        success: false,
        message:
          "Geçerli bir marka ID ve adı eşleşmesi bulunamadı. Lütfen 'ID [Sekme] Marka Adı' veya Excel tablosu formatında yapıştırınız.",
      };
    }

    await prisma.siteSettings.upsert({
      where: { key: "pazarama_brands" },
      create: { key: "pazarama_brands", value: { items, updatedAt: new Date().toISOString() } },
      update: { value: { items, updatedAt: new Date().toISOString() } },
    });

    try {
      revalidatePath("/admin/brands");
    } catch {}

    return {
      success: true,
      message: `Başarılı! ${items.length} adet Pazarama markası veritabanına kaydedildi.`,
      count: items.length,
    };
  } catch (error: any) {
    return { success: false, message: error.message || "Kaydetme hatası." };
  }
}

/**
 * Pazarama API'sinden Canlı Olarak Tüm Kategori ve Marka Ağacını Çeker ve Veritabanında ÖnBelleğe Alır.
 */
export async function syncPazaramaCategoriesAndBrandsFromApi() {
  await requireAdmin();
  try {
    const config = await (prisma as any).pazaramaConfig.findFirst();
    if (!config || !config.apiKey || !config.apiSecret) {
      return {
        success: false,
        message:
          "Pazarama API Kimlik bilgileriniz (API Key / Secret) henüz kaydedilmemiş. Lütfen Pazarama Ayarlar sayfasından bilgilerinizi giriniz.",
      };
    }

    const client = new PazaramaClient(config);

    // 1. Kategorileri API'den çek
    let catCount = 0;
    try {
      const categories = await client.getCategories();
      if (categories && categories.length > 0) {
        const flatten = (cats: any[], prefix = ""): Array<{ id: string; name: string }> => {
          let res: Array<{ id: string; name: string }> = [];
          for (const c of cats) {
            const id = String(c.id || c.categoryId || c.code || "").trim();
            const name = String(c.name || c.categoryName || c.title || "").trim();
            const fullName = prefix ? `${prefix} > ${name}` : name;
            if (id && name) res.push({ id, name: fullName });
            const subs = c.subCategories || c.subCategoriesList || c.children || c.items;
            if (Array.isArray(subs)) {
              res = res.concat(flatten(subs, fullName));
            }
          }
          return res;
        };

        const flattenedCats = flatten(categories);
        if (flattenedCats.length > 0) {
          catCount = flattenedCats.length;
          await prisma.siteSettings.upsert({
            where: { key: "pazarama_categories" },
            create: {
              key: "pazarama_categories",
              value: { items: flattenedCats, updatedAt: new Date().toISOString() },
            },
            update: {
              value: { items: flattenedCats, updatedAt: new Date().toISOString() },
            },
          });
        }
      }
    } catch (e: any) {
      console.error("Categories fetch error:", e);
    }

    // 2. Markaları API'den çek
    let brandCount = 0;
    try {
      const brands = await client.getBrands();
      if (brands && brands.length > 0) {
        brandCount = brands.length;
        await prisma.siteSettings.upsert({
          where: { key: "pazarama_brands" },
          create: {
            key: "pazarama_brands",
            value: { items: brands, updatedAt: new Date().toISOString() },
          },
          update: {
            value: { items: brands, updatedAt: new Date().toISOString() },
          },
        });
      }
    } catch (e: any) {
      console.error("Brands fetch error:", e);
    }

    try {
      revalidatePath("/admin/categories");
      revalidatePath("/admin/brands");
      revalidatePath("/admin/integrations/pazarama");
    } catch {}

    if (catCount === 0 && brandCount === 0) {
      return {
        success: false,
        message:
          "Pazarama API'sinden kategori veya marka yanıtı alınamadı. API Key ve Secret bilgilerinizi kontrol ediniz.",
      };
    }

    return {
      success: true,
      message: `Başarılı! Pazarama API'sinden ${catCount} kategori ve ${brandCount} marka başarıyla çekilerek kaydedildi.`,
      catCount,
      brandCount,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Pazarama API çekme hatası: ${error.message || "Bilinmeyen hata"}`,
    };
  }
}

// ==================== PRODUCT ACTIONS ====================

export async function getPazaramaProducts({
  page = 1,
  limit = 50,
  search = "",
  store = "ALL",
  brandId = "ALL",
}: {
  page?: number;
  limit?: number;
  search?: string;
  store?: string;
  brandId?: string;
} = {}) {
  await requireAdmin();
  try {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
        { brand: { name: { contains: search, mode: "insensitive" } } },
      ];
    }
    if (store && store !== "ALL") {
      where.store = store;
    }
    if (brandId && brandId !== "ALL") {
      where.brandId = brandId;
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
          pazaramaPrice: true,
          stock: true,
          images: true,
          isPazaramaActive: true,
          pazaramaStatus: true,
          pazaramaBatchId: true,
          brand: {
            select: { id: true, name: true },
          },
          categories: {
            select: {
              pazaramaCategoryId: true,
            },
          },
          pazaramaProduct: {
            select: {
              pazaramaCategoryId: true,
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
      data: products.map((p) => {
        const overrideCatId = (p as any).pazaramaProduct?.pazaramaCategoryId || null;
        const mappedCatId = p.categories.find((c) => c.pazaramaCategoryId)?.pazaramaCategoryId || null;
        return {
          ...p,
          listPrice: Number(p.listPrice),
          salePrice: p.salePrice ? Number(p.salePrice) : null,
          pazaramaPrice: p.pazaramaPrice ? Number(p.pazaramaPrice) : null,
          pazaramaOverrideCategoryId: overrideCatId,
          pazaramaCategoryId: overrideCatId || mappedCatId,
          mappedCategoryId: mappedCatId,
        };
      }),
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

export async function togglePazaramaProductActive(productId: string, currentState: boolean) {
  await requireAdmin();
  try {
    await prisma.product.update({
      where: { id: productId },
      data: { isPazaramaActive: !currentState },
    });
    // Kapatınca stok 0, açınca güncel stok Pazarama'ya gider
    syncPazaramaStockAndPrice([productId]).catch(console.error);

    revalidatePath("/admin/integrations/pazarama/products");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Güncelleme başarısız." };
  }
}

export async function syncProductsToPazarama(
  productIds: string[],
  attributes?: Array<{ attributeId: string; attributeValueId: string }>,
  commercialId?: string,
  securityDescription?: string
) {
  await requireAdmin();
  try {
    const config = await (prisma as any).pazaramaConfig.findFirst();
    if (!config || !config.isActive) {
      return { success: false, message: "Pazarama entegrasyonu aktif değil." };
    }

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { brand: true, categories: true, pazaramaProduct: true },
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
      const productOverrideCatId = (p as any).pazaramaProduct?.pazaramaCategoryId;
      const catWithPazarama = p.categories.find((c) => c.pazaramaCategoryId) || p.categories[0];
      const targetCategoryId = productOverrideCatId || catWithPazarama?.pazaramaCategoryId || undefined;

      const formattedImages = (p.images || []).map((img) => {
        if (img.startsWith("http")) return img;
        return `${siteUrl}${img.startsWith("/") ? "" : "/"}${img}`;
      });

      const criticalStock = p.criticalStock ?? 0;
      const effectiveStock = p.stock <= criticalStock ? 0 : Math.max(0, p.stock - criticalStock);

      return {
        code: p.sku || p.id,
        title: p.name,
        description: p.marketplaceDescription || p.description || p.name,
        barcode: p.barcode || p.sku || p.id,
        brandId: p.brand?.pazaramaBrandId || undefined,
        categoryId: targetCategoryId,
        listPrice: Math.round(Number(p.listPrice) * (1 + profitMargin / 100) * 100) / 100,
        salePrice: Math.round(finalPrice * 100) / 100,
        stockQuantity: effectiveStock,
        vatRate: p.vatRate || 20,
        images: formattedImages,
        attributes: attributes || [],
        commercialId: commercialId || undefined,
        securityDescription: securityDescription || undefined,
      };
    });

    const result = await client.createProductBatch(payloadProducts);

    // Seçilen temin şablonu varsa, her bir ürün koduna upsertSellerProductCommercial ile de bağla
    if (commercialId) {
      for (const p of products) {
        const code = p.barcode || p.sku || p.id;
        if (code) {
          try {
            await client.upsertSellerProductCommercial(code, [commercialId], securityDescription);
          } catch (err) {
            console.error(`[Pazarama] Temin şablonu bağlama hatası (${code}):`, err);
          }
        }
      }
    }

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
        message: `${products.length} adet ürün Pazarama'ya başarıyla aktarıldı.${commercialId ? " (Temin şablonu tanımlandı)" : ""} Paket ID: ${result.batchId}`,
      };
    } else {
      return { success: false, message: result.error || "Aktarım başarısız oldu." };
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Senkronizasyon hatası." };
  }
}

export async function getPazaramaCategoryAttributes(categoryId: string) {
  await requireAdmin();
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
  await requireAdmin();
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

    const items: Array<{ code: string; stock: number; price: number; listPrice?: number }> = [];

    for (const p of products) {
      const basePrice = Number(p.pazaramaPrice || p.salePrice || p.listPrice);
      const finalPrice = profitMargin > 0 ? basePrice * (1 + profitMargin / 100) : basePrice;
      const salePrice = Math.round(finalPrice * 100) / 100;
      let listPrice = Math.round(Number(p.listPrice || basePrice) * (1 + profitMargin / 100) * 100) / 100;
      if (listPrice < salePrice) listPrice = salePrice;

      const criticalStock = p.criticalStock ?? 0;
      // Pazarama'da kapalı veya sitede pasif ürün 0 stokla gider; aksi halde sipariş sonrası senkron onu tekrar satışa açıyordu
      const isSellable = p.isActive && p.isPazaramaActive;
      const effectiveStock = !isSellable || p.stock <= criticalStock ? 0 : Math.max(0, p.stock - criticalStock);

      if (p.barcode) {
        items.push({ code: p.barcode, stock: effectiveStock, price: salePrice, listPrice });
      }
      if (p.sku && p.sku !== p.barcode) {
        items.push({ code: p.sku, stock: effectiveStock, price: salePrice, listPrice });
      }
      if (!p.barcode && !p.sku) {
        items.push({ code: p.id, stock: effectiveStock, price: salePrice, listPrice });
      }
    }

    const result = await client.updateStockAndPrice(items);

    if (result.success) {
      try { revalidatePath("/admin/integrations/pazarama/products"); } catch {}
      return { success: true, message: result.message };
    } else {
      return { success: false, message: result.message };
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Güncelleme hatası." };
  }
}

export async function checkPazaramaBatchStatus(batchId: string) {
  await requireAdmin();
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
  await requireAdmin();
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
  await requireAdmin();
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
      // Etikette basılacak kargo kodu: anlaşmalı kargoda shipmentCode (PZ...), yoksa kargo takip no
      const pzBarcode = String(pOrder.shipmentCode || pOrder.cargoTrackingNumber || "").trim() || null;
      const pzCargoCompany = String(pOrder.cargoCompany || "").trim() || null;
      const pzTrackingUrl = String(pOrder.cargoTrackingUrl || "").trim() || null;

      if (existing) {
        const patch: any = {};
        if (existing.status !== newStatus) patch.status = newStatus;
        // Sonradan oluşan kargo bilgisini tamamla
        if (pzBarcode && existing.cargoTrackingNumber !== pzBarcode) patch.cargoTrackingNumber = pzBarcode;
        if (pzCargoCompany && existing.cargoCompany !== pzCargoCompany) patch.cargoCompany = pzCargoCompany;
        if (pzTrackingUrl && existing.trackingUrl !== pzTrackingUrl) patch.trackingUrl = pzTrackingUrl;
        if (Object.keys(patch).length > 0) {
          await prisma.order.update({ where: { id: existing.id }, data: patch });
          updatedCount++;
        }
        continue;
      }

      const resolvedItems: any[] = [];
      const stockUpdates: { productId?: string; variantId?: string; quantity: number }[] = [];
      let total = 0;
      let totalVat = 0;
      const unmatchedNames: string[] = [];

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

        // Birebir aynı ürün adı (tek eşleşme). Önceden "içeren" aramasıyla alakasız ürün seçilebiliyordu.
        if (!product && item.productName) {
          const sameName = await prisma.product.findMany({
            where: { name: { equals: String(item.productName).trim(), mode: "insensitive" } },
            take: 2,
          });
          if (sameName.length === 1) {
            product = sameName[0];
            productId = product.id;
          }
        }

        let isFallback = false;
        // Eğer ürün sitede henüz yoksa siparişin kaybolmaması için "Tanımsız Ürün"e bağla (stoğu düşülmez)
        if (!product) {
          const fallbackProd = await (await import("@/lib/unmatched-product")).getUnmatchedProduct();
          if (fallbackProd) {
            product = fallbackProd;
            productId = fallbackProd.id;
            isFallback = true;
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
            productName: item.productName || item.title || barcodeOrSku || product.name,
            quantity: lineQty,
            unitPrice: lineUnitPrice,
            lineTotal: lineInvoiceAmount,
            vatRate,
            discountRate: 0,
            stockDeducted: !isFallback,
          });
          if (isFallback) unmatchedNames.push(`${item.productName || "-"} (kod: ${barcodeOrSku || "-"})`);

          total += lineInvoiceAmount;
          totalVat += lineVat;

          if (!isFallback) {
            stockUpdates.push({ productId: product.id, variantId: variantId || undefined, quantity: lineQty });
            affectedProductIds.push(product.id);
          }
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
                fullName: pOrder.recipientName || pOrder.customerName || "Pazarama Müşterisi",
                address: pOrder.deliveryAddress?.address || "",
                city: pOrder.deliveryAddress?.city || "",
                district: pOrder.deliveryAddress?.district || "",
                phone: pOrder.customerPhone || "",
                postalCode: pOrder.deliveryAddress?.postalCode || "",
                taxNumber: pOrder.billingTaxNumber || undefined,
                taxOffice: pOrder.billingTaxOffice || undefined,
              },
              notes: unmatchedNames.length ? `DİKKAT: Sitede bulunamayan ürün, stok düşülmedi: ${unmatchedNames.join("; ")}` : undefined,
              items: { create: resolvedItems },
              cargoCompany: pzCargoCompany,
              cargoTrackingNumber: pzBarcode,
              trackingUrl: pzTrackingUrl,
              shipmentPackageId: pOrder.id || null,
            },
          });

          const { decrementOrderStock } = await import("@/lib/stock-sync");
          const decrementedIds = await decrementOrderStock(
            tx,
            stockUpdates.map(u => ({
              productId: u.productId,
              variantId: u.variantId,
              quantity: u.quantity,
            }))
          );
          decrementedIds.forEach(id => affectedProductIds.push(id));
        });

        importedCount++;
      }
    }

    if (affectedProductIds.length > 0) {
      const uniqueIds = Array.from(new Set(affectedProductIds));
      handlePostOrderStockSync(uniqueIds, "pazarama").catch(console.error);
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

/**
 * Siparişe ait kesilmiş faturanın linkini Pazarama'ya yükler / gönderir.
 */
export async function uploadPazaramaOrderInvoice(orderId: string) {
  await requireAdmin();
  try {
    const config = await (prisma as any).pazaramaConfig.findFirst({ where: { isActive: true } });
    if (!config) {
      return { success: false, message: "Aktif Pazarama konfigürasyonu bulunamadı." };
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return { success: false, message: "Sipariş bulunamadı." };
    }

    const invoiceUrl = (order as any).invoiceUrl;
    if (!invoiceUrl) {
      return { success: false, message: "Bu sipariş için sisteme yüklenmiş / kesilmiş bir fatura PDF linki bulunamadı. Önce faturayı kesiniz." };
    }

    const client = new PazaramaClient(config);
    const targetOrderId = order.shipmentPackageId || order.orderNumber;
    const fallbackOrderNumber = order.shipmentPackageId ? order.orderNumber : undefined;
    const result = await client.uploadInvoiceLink(targetOrderId, invoiceUrl, fallbackOrderNumber);

    if (result.success) {
      try {
        revalidatePath("/admin/orders");
        revalidatePath("/admin/integrations/pazarama/orders");
      } catch {}
      return { success: true, message: `Fatura linki Pazarama'ya başarıyla iletildi! ✅ (Sipariş No: ${order.orderNumber})` };
    } else {
      return { success: false, message: result.message || "Pazarama'ya fatura gönderilemedi." };
    }
  } catch (error: any) {
    console.error("uploadPazaramaOrderInvoice error:", error);
    return { success: false, message: error.message || "Pazarama fatura gönderim hatası." };
  }
}




// ==================== ÜRÜN BAZLI KATEGORİ OVERRIDE ====================

/**
 * Tekli ürüne Pazarama kategori override set etme
 * null geçilirse override kaldırılır, site kategori eşleşmesine düşer
 */
export async function setPazaramaProductCategory(productId: string, pazaramaCategoryId: string | null) {
  await requireAdmin();
  try {
    const cleanId = pazaramaCategoryId?.trim() || null;
    await (prisma as any).pazaramaProduct.upsert({
      where: { productId },
      update: { pazaramaCategoryId: cleanId },
      create: {
        productId,
        pazaramaCategoryId: cleanId,
      },
    });
    revalidatePath("/admin/integrations/pazarama/products");
    return {
      success: true,
      message: cleanId
        ? `Ürüne özel Pazarama kategorisi atandı: ${cleanId}`
        : "Ürüne özel kategori kaldırıldı, site eşleşmesi kullanılacak.",
    };
  } catch (error: any) {
    console.error("setPazaramaProductCategory error:", error);
    return { success: false, message: "Hata: " + error.message };
  }
}

/**
 * Toplu ürünlere Pazarama kategori override set etme
 */
export async function setBulkPazaramaProductCategory(productIds: string[], pazaramaCategoryId: string) {
  await requireAdmin();
  try {
    const cleanId = pazaramaCategoryId.trim();
    for (const productId of productIds) {
      await (prisma as any).pazaramaProduct.upsert({
        where: { productId },
        update: { pazaramaCategoryId: cleanId },
        create: {
          productId,
          pazaramaCategoryId: cleanId,
        },
      });
    }
    revalidatePath("/admin/integrations/pazarama/products");
    return {
      success: true,
      message: `${productIds.length} ürüne Pazarama kategori override atandı: ${cleanId}`,
    };
  } catch (error: any) {
    console.error("setBulkPazaramaProductCategory error:", error);
    return { success: false, message: "Hata: " + error.message };
  }
}

// ==================== TEMİN ŞABLONLARI (ÜRÜN GÜVENLİĞİ VE UYGUNLUK) ====================

/**
 * Pazarama Satıcı Temin Şablonlarını Getirir
 * (Önce API'den çeker, başarısız olursa veritabanı önbelleğine bakar)
 */
export async function getPazaramaCommercialTemplates() {
  await requireAdmin();
  try {
    const config = await (prisma as any).pazaramaConfig.findFirst({ where: { isActive: true } });
    if (!config) {
      return { success: false, message: "Aktif Pazarama konfigürasyonu bulunamadı.", data: [] };
    }

    const client = new PazaramaClient(config);
    const templates = await client.getCommercialTemplates();

    if (templates && templates.length > 0) {
      // Önbelleğe kaydet
      try {
        await prisma.siteSettings.upsert({
          where: { key: "pazarama_commercial_templates" },
          create: {
            key: "pazarama_commercial_templates",
            value: { items: templates, updatedAt: new Date().toISOString() },
          },
          update: {
            value: { items: templates, updatedAt: new Date().toISOString() },
          },
        });
      } catch (err) {
        console.error("Commercial templates cache error:", err);
      }
      return { success: true, data: templates, source: "api" };
    }

    // Fallback cache
    const saved = await prisma.siteSettings.findUnique({
      where: { key: "pazarama_commercial_templates" },
    });
    if (saved?.value && Array.isArray((saved.value as any).items)) {
      return { success: true, data: (saved.value as any).items, source: "cache" };
    }

    return { success: true, data: [], message: "Kayıtlı temin şablonu bulunamadı." };
  } catch (error: any) {
    console.error("getPazaramaCommercialTemplates error:", error);
    return { success: false, message: error.message || "Şablonlar çekilemedi.", data: [] };
  }
}

/**
 * Seçili ürünlere Pazarama Temin Şablonunu (Üretici/İthalatçı) bağlar
 * Endpoint: POST /product/upsertSellerProductCommercial
 */
export async function assignCommercialTemplateToProducts(
  productIds: string[],
  commercialId: string,
  securityDescription?: string
) {
  await requireAdmin();
  try {
    const config = await (prisma as any).pazaramaConfig.findFirst({ where: { isActive: true } });
    if (!config) {
      return { success: false, message: "Aktif Pazarama konfigürasyonu bulunamadı." };
    }

    if (!commercialId) {
      return { success: false, message: "Lütfen bir temin şablonu seçiniz." };
    }

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, barcode: true, sku: true },
    });

    if (products.length === 0) {
      return { success: false, message: "Seçili ürün bulunamadı." };
    }

    const client = new PazaramaClient(config);
    let successCount = 0;
    let failCount = 0;

    for (const p of products) {
      const code = p.barcode || p.sku || p.id;
      if (!code) continue;

      const res = await client.upsertSellerProductCommercial(
        code,
        [commercialId],
        securityDescription
      );

      if (res.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    return {
      success: successCount > 0,
      message: `${successCount} ürün için temin şablonu Pazarama'ya başarıyla tanımlandı.${failCount > 0 ? ` (${failCount} ürün başarısız)` : ""}`,
    };
  } catch (error: any) {
    console.error("assignCommercialTemplateToProducts error:", error);
    return { success: false, message: error.message || "İşlem sırasında hata oluştu." };
  }
}

/**
 * Sistemdeki kayıtlı markaları getirir (Filtreleme ve toplu marka ataması için)
 */
export async function getStoreBrands() {
  await requireAdmin();
  try {
    const brands = await prisma.brand.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return { success: true, data: brands };
  } catch (error: any) {
    return { success: false, data: [] };
  }
}

/**
 * Seçilen markaya ait TÜM ürünlere Pazarama Temin Şablonunu topluca atar.
 * Kullanıcıyı Excel ile tek tek uğraşmaktan tamamen kurtarır!
 */
export async function assignCommercialTemplateToBrand(
  brandId: string,
  commercialId: string,
  securityDescription?: string
) {
  await requireAdmin();
  try {
    const config = await (prisma as any).pazaramaConfig.findFirst({ where: { isActive: true } });
    if (!config) {
      return { success: false, message: "Aktif Pazarama konfigürasyonu bulunamadı." };
    }

    if (!brandId) {
      return { success: false, message: "Lütfen bir marka seçiniz." };
    }

    if (!commercialId) {
      return { success: false, message: "Lütfen bir temin şablonu seçiniz." };
    }

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { name: true },
    });

    const products = await prisma.product.findMany({
      where: { brandId },
      select: { id: true, barcode: true, sku: true, name: true },
    });

    if (products.length === 0) {
      return { success: false, message: `"${brand?.name || "Seçilen"}" markasına ait ürün bulunamadı.` };
    }

    const client = new PazaramaClient(config);
    let successCount = 0;
    let failCount = 0;

    for (const p of products) {
      const code = p.barcode || p.sku || p.id;
      if (!code) continue;

      try {
        const res = await client.upsertSellerProductCommercial(
          code,
          [commercialId],
          securityDescription
        );

        if (res.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (e) {
        failCount++;
      }
    }

    return {
      success: successCount > 0,
      message: `"${brand?.name || ""}" markasına ait ${successCount} adet ürünün Temin Şablonu Pazarama'ya başarıyla tanımlandı!${failCount > 0 ? ` (${failCount} ürün başarısız)` : ""}`,
      count: successCount,
    };
  } catch (error: any) {
    console.error("assignCommercialTemplateToBrand error:", error);
    return { success: false, message: error.message || "İşlem sırasında hata oluştu." };
  }
}

// ==================== PAZARAMA DURUM TAKİBİ ====================
// Gönderimde pazaramaStatus "PENDING" yazılıyordu ve hiçbir yer güncellemiyordu.
// Doküman: batch sonucu sadece 4 saat sorgulanabiliyor; daha eskiler getProductDetail ile kontrol edilir.

const PAZARAMA_BATCH_STATUS: Record<number, string> = { 1: "İşleniyor", 2: "Tamamlandı", 3: "Hata" };

async function getPazaramaClientIfActive() {
  const config = await (prisma as any).pazaramaConfig.findFirst();
  if (!config || !config.isActive) return null;
  return new PazaramaClient(config);
}

function pazaramaCodes(p: { sku?: string | null; barcode?: string | null; id: string }) {
  // Ürün oluşturmada code = sku || id; stok senkronu barkod ve sku'yu da gönderiyor
  return Array.from(new Set([p.sku, p.barcode, p.id].filter(Boolean) as string[]));
}

/** Tek ürünü Pazarama'da sorgular, durumu ürün kaydına yazar */
export async function verifyPazaramaProduct(productId: string): Promise<{ success: boolean; status?: string; message: string }> {
  await requireAdmin();
  try {
    const client = await getPazaramaClientIfActive();
    if (!client) return { success: false, message: "Pazarama entegrasyonu aktif değil." };
    const p = await prisma.product.findUnique({ where: { id: productId }, select: { id: true, sku: true, barcode: true } });
    if (!p) return { success: false, message: "Ürün bulunamadı." };

    for (const code of pazaramaCodes(p)) {
      const res = await client.getProductDetail(code);
      if (res.success && res.data) {
        const status = res.data.stateDescription || (res.data.state === 3 ? "Onaylandı" : `Durum ${res.data.state}`);
        await prisma.product.update({ where: { id: productId }, data: { pazaramaStatus: status } });
        return {
          success: true,
          status,
          message: `Pazarama'da bulundu (${code}). Durum: ${status}, Stok: ${res.data.stockCount ?? "-"}, Fiyat: ${res.data.salePrice ?? "-"} TL`,
        };
      }
    }
    await prisma.product.update({ where: { id: productId }, data: { pazaramaStatus: "Pazarama'da bulunamadı" } });
    return { success: true, status: "Pazarama'da bulunamadı", message: `Pazarama'da ${pazaramaCodes(p).join(" / ")} kodlarıyla ürün bulunamadı.` };
  } catch (error: any) {
    return { success: false, message: "Pazarama hatası: " + error.message };
  }
}

/** "PENDING" kalmış ürünlerin gönderim sonucunu alır (Pazarama sipariş cron'undan çağrılır) */
export async function resolvePendingPazaramaStatuses() {
  await requireAdmin();
  const client = await getPazaramaClientIfActive();
  if (!client) return { checked: 0 };
  const pending = await prisma.product.findMany({
    where: { pazaramaStatus: "PENDING" },
    select: { id: true, sku: true, barcode: true, pazaramaBatchId: true },
    take: 50,
  });

  let updated = 0;
  const batchCache = new Map<string, any>();
  for (const p of pending) {
    let status: string | null = null;
    if (p.pazaramaBatchId) {
      if (!batchCache.has(p.pazaramaBatchId)) {
        const r = await client.getBatchStatus(p.pazaramaBatchId).catch(() => null);
        batchCache.set(p.pazaramaBatchId, r?.success ? r.data?.data ?? r.data : null);
      }
      const batch = batchCache.get(p.pazaramaBatchId);
      if (batch && typeof batch.status === "number") {
        if (batch.status === 1) continue; // hâlâ işleniyor
        const codes = pazaramaCodes(p);
        const failed = (batch.failedProducts || []).filter((fp: any) => codes.includes(String(fp.productCode)));
        status = failed.length > 0
          ? `Hata: ${failed.map((fp: any) => fp.errorReason).join("; ")}`.slice(0, 250)
          : "Gönderildi (onay bekliyor)";
      }
    }
    if (!status) {
      // Batch 4 saatten eski veya sorgulanamadı: ürünü doğrudan sorgula
      const v = await verifyPazaramaProduct(p.id).catch(() => null);
      if (v?.success) updated++;
      continue;
    }
    await prisma.product.update({ where: { id: p.id }, data: { pazaramaStatus: status } });
    updated++;
  }
  try { revalidatePath("/admin/integrations/pazarama/products"); } catch {}
  return { checked: pending.length, updated };
}

/** Pazarama'daki tüm onaylı ürünleri çekip kodu eşleşen site ürünlerinin durumunu "Onaylandı" yapar */
export async function matchPazaramaApprovedProducts() {
  await requireAdmin();
  try {
    const client = await getPazaramaClientIfActive();
    if (!client) return { success: false, message: "Pazarama entegrasyonu aktif değil." };

    const approved = new Set<string>();
    const liveCodes = new Set<string>(); // satışta ve stoklu ilanlar
    let stockKnown = true;
    let cursor: string | null = null;
    for (let page = 0; page < 300; page++) {
      const { products, nextCursor } = await client.getApprovedProducts(cursor);
      for (const ap of products) {
        if (!ap.code) continue;
        approved.add(String(ap.code));
        const lv = isListingLive(ap);
        if (!lv.stockKnown) stockKnown = false;
        if (lv.live) liveCodes.add(String(ap.code));
      }
      if (!nextCursor || products.length === 0) break;
      cursor = nextCursor;
    }
    if (approved.size === 0) return { success: false, message: "Pazarama'dan onaylı ürün alınamadı." };

    const products = await prisma.product.findMany({ select: { id: true, sku: true, barcode: true, pazaramaStatus: true, isActive: true, isPazaramaActive: true } });
    let matched = 0;
    const matchedRemote = new Set<string>();
    const liveButClosed: string[] = [];
    for (const p of products) {
      const hits = pazaramaCodes(p).filter((code) => approved.has(code));
      hits.forEach((c) => matchedRemote.add(c));
      if (hits.length === 0) continue;
      if (hits.some((c) => liveCodes.has(c)) && !(p.isActive && (p as any).isPazaramaActive)) liveButClosed.push(p.sku || hits[0]);
      if (p.pazaramaStatus === "Onaylandı") continue;
      await prisma.product.update({ where: { id: p.id }, data: { pazaramaStatus: "Onaylandı" } });
      matched++;
    }
    revalidatePath("/admin/integrations/pazarama/products");
    return {
      success: true,
      message: `Pazarama'da ${approved.size} onaylı ürün bulundu. ${matched} ürünün durumu "Onaylandı" yapıldı.` +
        formatListingReport([...liveCodes].filter((c) => !matchedRemote.has(c)), liveButClosed, stockKnown),
    };
  } catch (error: any) {
    return { success: false, message: "Pazarama hatası: " + error.message };
  }
}
