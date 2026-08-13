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

// ==================== HELPER FUNCTIONS ====================

function sanitizeVatRate(rawVat?: number | null): number {
  if (!rawVat || isNaN(rawVat)) return 20;
  const vat = Number(rawVat);
  if (vat <= 0) return 0;
  if (vat <= 1) return 1;
  if (vat <= 10) return 10;
  return 20;
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
    });

    if (products.length === 0) {
      return { success: true, message: "ePttAVM için aktarılacak aktif ürün bulunamadı." };
    }

    const profitMargin = config.profitMargin || 0;
    const items: PttavmStockPriceItem[] = [];

    for (const p of products) {
      const basePrice = Number(p.pttavmPrice || p.salePrice || p.listPrice);
      const finalPriceWithVat = profitMargin > 0 ? basePrice * (1 + profitMargin / 100) : basePrice;
      const vatRate = sanitizeVatRate(p.vatRate);
      const priceWithoutVAT = Math.round((finalPriceWithVat / (1 + vatRate / 100)) * 100) / 100;
      const priceWithoutVat = priceWithoutVAT;
      const priceWithVAT = Math.round(finalPriceWithVat * 100) / 100;

      const criticalStock = p.criticalStock ?? 0;
      const availableStock = p.stock <= criticalStock ? 0 : Math.max(0, p.stock - criticalStock);

      const validVariants = p.variants?.filter((v: any) => v.barcode || v.sku) || [];
      if (validVariants.length > 0) {
        for (const v of validVariants) {
          const varAvailableStock = v.stock <= criticalStock ? 0 : Math.max(0, v.stock - criticalStock);
          items.push({
            barcode: v.barcode || v.sku,
            active: p.isActive && varAvailableStock > 0,
            quantity: varAvailableStock,
            stock: varAvailableStock,
            priceWithoutVAT,
            priceWithoutVat,
            priceWithVAT,
            vatRate,
            discount: 0,
            isCargoFromSupplier: true,
          });
        }
      } else if (p.barcode || p.sku) {
        const barcodeVal = (p.barcode || p.sku || "").trim();
        items.push({
          barcode: barcodeVal,
          active: p.isActive && availableStock > 0,
          quantity: availableStock,
          stock: availableStock,
          priceWithoutVAT,
          priceWithoutVat,
          priceWithVAT,
          vatRate,
          discount: 0,
          isCargoFromSupplier: true,
        });
      }
    }

    if (items.length === 0) {
      return { success: false, message: "Barkodlu veya SKU'lu ürün bulunamadı." };
    }

    // Batching in chunks of 1000 items (ePttAVM API rate limit)
    const BATCH_SIZE = 1000;
    const trackingIds: string[] = [];
    let lastResult: any = null;

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const chunk = items.slice(i, i + BATCH_SIZE);
      lastResult = await client.updateStockAndPrice(chunk);
      if (lastResult?.trackingId) {
        trackingIds.push(lastResult.trackingId);
      }
      if (i + BATCH_SIZE < items.length) {
        await new Promise((res) => setTimeout(res, 1000));
      }
    }

    const mainTrackingId = trackingIds.join(", ") || lastResult?.trackingId || null;

    for (const p of products) {
      await (prisma as any).pttavmProduct.upsert({
        where: { productId: p.id },
        update: {
          trackingId: mainTrackingId,
          isSynced: lastResult?.success ?? true,
          batchStatus: lastResult?.success ? "COMPLETED" : "FAILED",
          lastSyncedAt: new Date(),
          lastSyncError: lastResult?.message || null,
        },
        create: {
          productId: p.id,
          barcode: p.barcode,
          trackingId: mainTrackingId,
          isSynced: lastResult?.success ?? true,
          batchStatus: lastResult?.success ? "COMPLETED" : "FAILED",
          lastSyncedAt: new Date(),
        },
      });
    }

    try {
      revalidatePath("/admin/integrations/pttavm");
    } catch {}

    return {
      success: true,
      message: `${items.length} adet ürün stok/fiyatı ePttAVM'ye iletildi. Tracking ID: ${mainTrackingId || "Tamamlandı"}`,
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
      const vatRate = sanitizeVatRate(p.vatRate);
      const priceWithoutVAT = Math.round((finalPriceWithVat / (1 + vatRate / 100)) * 100) / 100;
      const priceWithVAT = Math.round(finalPriceWithVat * 100) / 100;

      const criticalStock = p.criticalStock ?? 0;
      const availableStock = p.stock <= criticalStock ? 0 : Math.max(0, p.stock - criticalStock);

      const formattedImages = (p.images || []).map((img, idx) => {
        const fullUrl = img.startsWith("http") ? img : `${siteUrl}${img.startsWith("/") ? "" : "/"}${img}`;
        return { url: fullUrl, order: idx + 1 };
      });

      const catWithPttavm = p.categories.find((c) => c.pttavmCategoryId) || p.categories[0];
      const defaultCatId = p.name.toLowerCase().includes("pedal") ? 1875 : (p.store === "MOTOR" ? 3502 : 1891);
      const categoryId = Number(catWithPttavm?.pttavmCategoryId || defaultCatId);
      const brandId = p.brand?.pttavmBrandId ? Number(p.brand.pttavmBrandId) : undefined;
      const desi = Math.max(1, Math.round(Number(p.desi || 1)));
      const productBarcode = (p.barcode || p.sku || "").trim();

      // Format variants to prevent ePttAVM from deleting existing variants
      const formattedVariants = (p.variants || [])
        .filter((v: any) => v.barcode || v.sku)
        .map((v: any) => {
          const varAvailableStock = v.stock <= criticalStock ? 0 : Math.max(0, v.stock - criticalStock);
          const attributes: any[] = [];
          if (v.color) attributes.push({ definition: "Renk", value: v.color });
          if (v.size) attributes.push({ definition: "Beden", value: v.size });
          if (attributes.length === 0 && v.name) attributes.push({ definition: "Varyant", value: v.name });

          return {
            variantBarcode: v.barcode || v.sku,
            quantity: varAvailableStock,
            price: 0,
            catalogBarcode: v.barcode || v.sku,
            attributes,
          };
        });

      if (productBarcode) {
        const prodDesc = (p.marketplaceDescription || p.description || p.name).trim();
        const stockCodeVal = (p.sku || productBarcode).trim();
        const brandNameVal = p.brand?.name || "Diğer";

        const itemPayload: PttavmProductUpsertItem = {
          barcode: productBarcode,
          gtin: productBarcode,
          ean: productBarcode,
          sku: stockCodeVal,
          stockCode: stockCodeVal,
          merchantItemCode: stockCodeVal,
          active: p.isActive,
          title: p.name,
          name: p.name,
          description: prodDesc,
          longDescription: prodDesc,
          shortDescription: prodDesc.slice(0, 250),
          productDescription: prodDesc,
          details: prodDesc,
          categoryId,
          brandId,
          brand: brandNameVal,
          brandName: brandNameVal,
          quantity: availableStock,
          stock: availableStock,
          priceWithoutVAT,
          priceWithoutVat: priceWithoutVAT,
          priceWithVAT,
          vatRate,
          discount: 0,
          desi,
          images: formattedImages,
          isCargoFromSupplier: true,
        };

        if (formattedVariants.length > 0) {
          itemPayload.variants = formattedVariants;
        }

        upsertItems.push(itemPayload);
      }
    }

    if (upsertItems.length === 0) {
      return { success: false, message: "Gönderilecek geçerli barkodlu ürün bulunamadı." };
    }

    // Batching in chunks of 1000 items (ePttAVM API rate limit)
    const BATCH_SIZE = 1000;
    const trackingIds: string[] = [];
    let lastResult: any = null;

    for (let i = 0; i < upsertItems.length; i += BATCH_SIZE) {
      const chunk = upsertItems.slice(i, i + BATCH_SIZE);
      lastResult = await client.upsertProducts(chunk);
      if (lastResult?.trackingId) {
        trackingIds.push(lastResult.trackingId);
      }
      if (i + BATCH_SIZE < upsertItems.length) {
        await new Promise((res) => setTimeout(res, 1000));
      }
    }

    const mainTrackingId = trackingIds.join(", ") || lastResult?.trackingId || null;

    for (const p of products) {
      await (prisma as any).pttavmProduct.upsert({
        where: { productId: p.id },
        update: {
          trackingId: mainTrackingId,
          isSynced: lastResult?.success ?? true,
          batchStatus: lastResult?.success ? "COMPLETED" : "FAILED",
          lastSyncedAt: new Date(),
          lastSyncError: lastResult?.message || null,
        },
        create: {
          productId: p.id,
          barcode: p.barcode,
          trackingId: mainTrackingId,
          isSynced: lastResult?.success ?? true,
          batchStatus: lastResult?.success ? "COMPLETED" : "FAILED",
          lastSyncedAt: new Date(),
        },
      });
    }

    try {
      revalidatePath("/admin/integrations/pttavm");
    } catch {}

    return {
      success: true,
      message: `${upsertItems.length} ürün ePttAVM kataloğuna aktarıldı. Tracking ID: ${mainTrackingId || "Tamamlandı"}`,
      trackingId: mainTrackingId,
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

    // Query both active orders awaiting shipping (isActiveOrders: true) and all recent orders (isActiveOrders: false)
    const [resActive, resHistory] = await Promise.all([
      client.getOrders({
        startDate: formatDate(thirtyDaysAgo),
        endDate: formatDate(now),
        isActiveOrders: true,
        pageSize: 100,
      }).catch(() => null),
      client.getOrders({
        startDate: formatDate(thirtyDaysAgo),
        endDate: formatDate(now),
        isActiveOrders: false,
        pageSize: 100,
      }).catch(() => null),
    ]);

    const itemsActive = Array.isArray(resActive) ? resActive : (resActive?.items || resActive?.orders || []);
    const itemsHistory = Array.isArray(resHistory) ? resHistory : (resHistory?.items || resHistory?.orders || []);

    const orderMap = new Map<string, any>();
    for (const item of [...itemsActive, ...itemsHistory]) {
      const pttId = String(item.id || item.siparisNo || item.orderId || "");
      if (pttId && !orderMap.has(pttId)) {
        orderMap.set(pttId, item);
      }
    }

    const items = Array.from(orderMap.values());

    if (items.length === 0) {
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

            // 1b. Core numeric SKU extraction (e.g. "bm-lpk-mc-000310150-00-29817" -> "000310150")
            if (!dbProd) {
              const coreNum = (barcode.match(/\d{5,}/) || [])[0];
              if (coreNum) {
                dbProd = await prisma.product.findFirst({
                  where: { OR: [{ sku: { contains: coreNum, mode: "insensitive" } }, { barcode: { contains: coreNum, mode: "insensitive" } }] },
                });
                if (!dbProd) {
                  const variant = await prisma.productVariant.findFirst({
                    where: { OR: [{ sku: { contains: coreNum, mode: "insensitive" } }, { barcode: { contains: coreNum, mode: "insensitive" } }] },
                    include: { product: true },
                  });
                  if (variant?.product) dbProd = variant.product;
                }
              }
            }
          }

          // Smart title cross-check if matched product name conflicts with order title dimensions or SET vs SINGLE product status
          if (dbProd && rawTitle && rawTitle !== "ePttAVM Ürünü") {
            const cleanTitle = rawTitle.replace(/\s*-\s*/g, "-");
            const rawLower = cleanTitle.toLowerCase();
            const dbLower = dbProd.name.toLowerCase();
            
            const tokens = cleanTitle.split(" ").map((t) => t.trim()).filter(Boolean);
            const brandWord = tokens[0] || "";
            const sizeTokens = tokens.filter((t) => /\d+\.\d+/.test(t) || /\d+-\d+/.test(t));
            const missingSizes = sizeTokens.filter((s) => !dbLower.includes(s.toLowerCase()));
            const isRawSingle = !rawLower.includes("set") && !rawLower.includes("takım");
            const isDbSet = dbLower.includes("set") || dbLower.includes("takım");

            if (missingSizes.length > 0 || (isRawSingle && isDbSet)) {
              const queryConditions: any[] = [];
              if (brandWord && brandWord.length >= 2) {
                queryConditions.push({ name: { contains: brandWord, mode: "insensitive" } });
              }
              
              sizeTokens.forEach((s: string) => {
                queryConditions.push({ name: { contains: s, mode: "insensitive" } });
              });

              if (isRawSingle) {
                queryConditions.push({ NOT: { name: { contains: "Seti", mode: "insensitive" } } });
              }

              if (queryConditions.length > 0) {
                const betterMatch = await prisma.product.findFirst({
                  where: { AND: queryConditions },
                });

                if (betterMatch) {
                  dbProd = betterMatch;
                }
              }
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
          const cargoTrackingNumber = item.kargoBarkod ? String(item.kargoBarkod).trim() : null;
          const cargoCompany = "PTT Kargo";
          const shipmentPackageId = cargoTrackingNumber || orderNumber;
          const trackingUrl = cargoTrackingNumber ? `https://gonderitakip.ptt.gov.tr/Track/Detail?id=${cargoTrackingNumber}` : null;

          // Map ePttAVM order status to local Order status
          const rawStatusStr = String(item.siparisDurumu || item.durum || state || "").toLowerCase();
          let targetOrderStatus: "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED" = "CONFIRMED";
          if (rawStatusStr.includes("gonderilmis") || rawStatusStr.includes("gönderilmiş") || cargoTrackingNumber) {
            targetOrderStatus = "SHIPPED";
          }
          if (rawStatusStr.includes("tamamlandi") || rawStatusStr.includes("tamamlandı") || rawStatusStr.includes("teslim")) {
            targetOrderStatus = "DELIVERED";
          }
          if (rawStatusStr.includes("iptal") || rawStatusStr.includes("iade") || rawStatusStr.includes("gecersiz")) {
            targetOrderStatus = "CANCELLED";
          }

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
                  status: targetOrderStatus,
                  cargoCompany,
                  cargoTrackingNumber,
                  shipmentPackageId,
                  trackingUrl,
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
            // Update existing order status, cargo tracking details, address & email
            const statusChanged = existingOrder.status !== targetOrderStatus;
            const cargoChanged = cargoTrackingNumber && existingOrder.cargoTrackingNumber !== cargoTrackingNumber;
            const hasIncompleteItems = existingOrder.items.some(i => i.productName === "ePttAVM Ürünü" || Number(i.unitPrice) === 0);

            if (statusChanged || cargoChanged || hasIncompleteItems || existingOrder.guestEmail === "pttavm@customer.com" || (existingOrder.shippingAddress as any)?.city === "Türkiye") {
              const { restoreOrderStock, handlePostOrderStockSync } = await import("@/lib/stock-sync");

              const affectedIds = await prisma.$transaction(async (tx) => {
                let affected: string[] = [];

                if (hasIncompleteItems) {
                  await tx.orderItem.deleteMany({ where: { orderId: existingOrder.id } });
                }

                await tx.order.update({
                  where: { id: existingOrder.id },
                  data: {
                    status: targetOrderStatus,
                    cargoCompany,
                    cargoTrackingNumber: cargoTrackingNumber || existingOrder.cargoTrackingNumber,
                    shipmentPackageId: shipmentPackageId || existingOrder.shipmentPackageId,
                    trackingUrl: trackingUrl || existingOrder.trackingUrl,
                    total: finalTotal,
                    subtotal: finalTotal,
                    vatAmount: Math.round(finalTotal * 0.2 * 100) / 100,
                    guestEmail: customerEmail,
                    shippingAddress: shippingAddressObj,
                    ...(hasIncompleteItems ? { items: { create: orderItemsPayload } } : {}),
                  },
                });

                // If status changed to CANCELLED, restore stock
                if (statusChanged && targetOrderStatus === "CANCELLED" && existingOrder.status !== "CANCELLED") {
                  affected = await restoreOrderStock(tx, existingOrder.items.map(i => ({ productId: i.productId, quantity: i.quantity })));
                }

                return affected;
              });

              if (affectedIds.length > 0) {
                handlePostOrderStockSync(affectedIds, "pttavm").catch(console.error);
              }
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
    if (search && search.trim()) {
      const cleanSearch = search.trim();
      where.OR = [
        { name: { contains: cleanSearch, mode: "insensitive" } },
        { sku: { contains: cleanSearch, mode: "insensitive" } },
        { barcode: { contains: cleanSearch, mode: "insensitive" } },
        { variants: { some: { OR: [{ sku: { contains: cleanSearch, mode: "insensitive" } }, { barcode: { contains: cleanSearch, mode: "insensitive" } }] } } },
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
    const newState = !currentState;
    await prisma.product.update({
      where: { id: productId },
      data: { isPttavmActive: newState },
    });

    // Notify live ePttAVM API if active config exists
    try {
      const config = await (prisma as any).pttavmConfig.findFirst({ where: { isActive: true } });
      if (config) {
        const pttProduct = await (prisma as any).pttavmProduct.findFirst({ where: { productId } });
        const product = await prisma.product.findUnique({ where: { id: productId }, select: { barcode: true, sku: true } });
        const pttavmId = pttProduct?.pttavmId || product?.barcode || product?.sku || productId;

        const client = new PttavmClient({
          apiKey: config.apiKey,
          accessToken: config.accessToken,
          profitMargin: config.profitMargin || 0,
          isTestMode: Boolean(config.isTestMode),
        });

        await client.updateProductStatus(pttavmId, newState);
      }
    } catch (err: any) {
      console.warn("ePttAVM API updateProductStatus warning:", err.message);
    }

    revalidatePath("/admin/integrations/pttavm/products");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: "Güncelleme başarısız: " + error.message };
  }
}

/**
  * ePttAVM İşlem Durumu Sorgulama (Tracking Result)
  * GET /api/v1/products/tracking-result/{trackingId}
  */
export async function checkPttavmTrackingResult(trackingId: string) {
  try {
    const config = await (prisma as any).pttavmConfig.findFirst({ where: { isActive: true } });
    if (!config) {
      return { success: false, message: "Aktif ePttAVM entegrasyonu bulunamadı." };
    }

    const client = new PttavmClient({
      apiKey: config.apiKey,
      accessToken: config.accessToken,
      isTestMode: Boolean(config.isTestMode),
    });

    const result = await client.getTrackingResult(trackingId);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, message: "Tracking sorgulama hatası: " + error.message };
  }
}

/**
  * ePttAVM Barkod İle Ürün Sorgulama
  * POST /api/v1/products/get-by-barcodes
  */
export async function getProductsByBarcodesPttavm(barcodes: string[]) {
  try {
    const config = await (prisma as any).pttavmConfig.findFirst({ where: { isActive: true } });
    if (!config) {
      return { success: false, message: "Aktif ePttAVM entegrasyonu bulunamadı." };
    }

    const client = new PttavmClient({
      apiKey: config.apiKey,
      accessToken: config.accessToken,
      isTestMode: Boolean(config.isTestMode),
    });

    const result = await client.getProductsByBarcodes(barcodes);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, message: "Barkod sorgulama hatası: " + error.message };
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

/**
 * Fatura Linkini veya PDF Base64 Verisini ePttAVM'ye Yükleme
 * POST /api/v1/orders/{orderId}/invoice
 */
export async function uploadInvoiceToPttavm(orderNumber: string, invoiceUrl: string, pdfBase64?: string): Promise<{ success: boolean; message: string }> {
  try {
    const config = await (prisma as any).pttavmConfig.findFirst({ where: { isActive: true } });
    if (!config) {
      return { success: false, message: "ePttAVM entegrasyonu aktif değil." };
    }

    const { PttavmClient } = await import("@/services/pttavm/api");
    const client = new PttavmClient(config);

    // Fetch order detail from PttAVM to extract exact lineItemIds
    let lineItemIds: number[] = [];
    try {
      const pttOrder = await client.getOrderDetail(orderNumber);
      const rawOrder = Array.isArray(pttOrder) ? pttOrder[0] : (pttOrder?.data || pttOrder?.order || pttOrder);
      const items = Array.isArray(rawOrder?.siparisUrunler)
        ? rawOrder.siparisUrunler
        : (Array.isArray(rawOrder?.items) ? rawOrder.items : []);
      
      lineItemIds = items
        .map((i: any) => Number(i.lineItemId || i.siparisUrunId || i.id || i.lineId))
        .filter((id: number) => !isNaN(id) && id > 0);
    } catch (err: any) {
      console.warn(`PttAVM order detail fetch warning for ${orderNumber}:`, err.message);
    }

    // Fallback lineItemId if detail couldn't fetch line items
    if (lineItemIds.length === 0) {
      lineItemIds = [1];
    }

    const payload: any = {
      lineItemId: lineItemIds,
      url: invoiceUrl || null,
      content: pdfBase64 || null,
    };

    const res = await client.sendInvoice(orderNumber, payload);
    const isSuccess = res?.success === true || res?.isSuccess === true || !res?.error_Message;

    if (isSuccess) {
      return { success: true, message: "Fatura ePttAVM'ye başarıyla yüklendi ✅" };
    } else {
      return { success: false, message: res?.error_Message || res?.message || "ePttAVM fatura yükleme başarısız" };
    }
  } catch (error: any) {
    console.error("uploadInvoiceToPttavm Error:", error);
    return { success: false, message: "ePttAVM fatura hatası: " + error.message };
  }
}



