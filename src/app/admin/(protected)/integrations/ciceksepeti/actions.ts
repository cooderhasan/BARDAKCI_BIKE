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
        brand: true,
        category: { include: { parent: true } },
        categories: { include: { parent: true } },
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
        // ÖNCELİK SIRASI:
        // 1) Ürüne özel CiceksepetiProduct.ciceksepetiCategoryId (ürün bazında eşleştirme)
        // 2) Ürünün categories[] dizisindeki herhangi bir kategorinin ciceksepetiCategoryId'si
        // 3) Üst kategoriler (parent chain)
        // 4) DB'den benzer isimli kategori

        let rawCatId: string | null = null;
        const productCatName = p.category?.name || p.categories?.[0]?.name || "Bilinmeyen";

        // 1) Ürüne özel Çiçeksepeti kategori ID'si (EN ÖNCELİKLİ)
        if (p.ciceksepetiProduct?.ciceksepetiCategoryId) {
          rawCatId = p.ciceksepetiProduct.ciceksepetiCategoryId;
          console.log(`[CS-SYNC] "${p.name}" -> Ürün bazında ciceksepetiCategoryId: ${rawCatId}`);
        }

        // 2) Ürünün tüm categories[] dizisini tara
        if (!rawCatId && p.categories?.length) {
          for (const cat of p.categories) {
            if (cat.ciceksepetiCategoryId) {
              rawCatId = cat.ciceksepetiCategoryId;
              console.log(`[CS-SYNC] "${p.name}" -> categories'den bulundu: "${cat.name}" = ${rawCatId}`);
              break;
            }
            if (cat.parent?.ciceksepetiCategoryId) {
              rawCatId = cat.parent.ciceksepetiCategoryId;
              console.log(`[CS-SYNC] "${p.name}" -> categories parent'dan bulundu: "${cat.parent.name}" = ${rawCatId}`);
              break;
            }
          }
        }

        // 3) category (tekil) alanı
        if (!rawCatId && p.category?.ciceksepetiCategoryId) {
          rawCatId = p.category.ciceksepetiCategoryId;
        }
        if (!rawCatId && p.category?.parent?.ciceksepetiCategoryId) {
          rawCatId = p.category.parent.ciceksepetiCategoryId;
        }

        // 4) DB'den benzer isimli herhangi bir kategoride eşleştirme ara
        if (!rawCatId && productCatName !== "Bilinmeyen") {
          const allMapped = await prisma.category.findMany({
            where: { ciceksepetiCategoryId: { not: null } },
            select: { ciceksepetiCategoryId: true, name: true },
          });
          const normalize = (s: string) => s.toLowerCase().replace(/[ıİüÜöÖçÇşŞğĞ]/g, (c: string) => {
            const map: Record<string, string> = { 'ı': 'i', 'İ': 'i', 'ü': 'u', 'Ü': 'u', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c', 'ş': 's', 'Ş': 's', 'ğ': 'g', 'Ğ': 'g' };
            return map[c] || c;
          }).trim();
          const norm = normalize(productCatName);
          for (const mc of allMapped) {
            const mcNorm = normalize(mc.name || "");
            if (mcNorm === norm || mcNorm.includes(norm) || norm.includes(mcNorm)) {
              rawCatId = mc.ciceksepetiCategoryId;
              console.log(`[CS-SYNC] "${p.name}" -> Benzer isimli kategori bulundu: "${mc.name}" = ${rawCatId}`);
              break;
            }
          }
        }

        if (!rawCatId) {
          const catNames = p.categories?.map((c: any) => c.name).join(", ") || productCatName;
          throw new Error(`'${p.name}' ürünü (Kategoriler: ${catNames}) için Çiçeksepeti Kategori ID tanımlanmamış. Çiçeksepeti ürün listesinden bu ürüne kategori atayabilirsiniz.`);
        }

        const categoryId = parseInt(rawCatId) || 0;
        const basePrice = Number(p.ciceksepetiPrice || p.salePrice || p.listPrice);
        const salesPrice = profitMargin > 0 ? Math.round(basePrice * (1 + profitMargin / 100) * 100) / 100 : basePrice;
        const listPrice = Number(p.listPrice) >= salesPrice ? Number(p.listPrice) : salesPrice;

        // Kategoriye özel kaydedilmiş Çiçeksepeti niteliklerini al
        const targetCatId = p.categoryId || p.category?.id || p.categories?.[0]?.id || "";
        const savedCategoryAttrs = await (prisma as any).ciceksepetiCategoryAttribute.findMany({
          where: { categoryId: targetCatId },
        });

        // Ürün Nitelikleri (Attributes: Marka, Cinsiyet, Fren Tipi, Menşei vb.)
        const attributes: any[] = [];

        // Önce Kategoriye Özel Kaydedilmiş Nitelikleri ekle
        for (const savedAttr of savedCategoryAttrs) {
          if (savedAttr.selectedAttributeValueId) {
            attributes.push({
              attributeId: Number(savedAttr.attributeId) || savedAttr.attributeId,
              attributeValueId: Number(savedAttr.selectedAttributeValueId) || savedAttr.selectedAttributeValueId,
              attributeName: savedAttr.attributeName,
            });
          } else if (savedAttr.customValue) {
            attributes.push({
              attributeId: Number(savedAttr.attributeId) || savedAttr.attributeId,
              customAttributeValue: savedAttr.customValue,
              attributeName: savedAttr.attributeName,
            });
          }
        }

        if (p.brand?.name) {
          attributes.push({
            attributeName: "Marka",
            customAttributeValue: p.brand.name,
          });
        }
        if (p.gender && p.gender !== "none") {
          attributes.push({
            attributeName: "Cinsiyet",
            customAttributeValue: p.gender,
          });
        }
        if (p.brakeType && p.brakeType !== "none") {
          attributes.push({
            attributeName: "Fren Tipi",
            customAttributeValue: p.brakeType,
          });
        }
        if (p.origin) {
          attributes.push({
            attributeName: "Menşei",
            customAttributeValue: p.origin,
          });
        }

        productInputs.push({
          productName: p.name,
          productCode: p.sku || p.barcode || p.id,
          stockCode: p.barcode || p.sku || p.id,
          mainCategoryId: categoryId,
          description: p.marketplaceDescription || p.description || p.name,
          deliveryType: 1, // 1 = Kargo ile Teslimat
          deliveryDays: 1, // 1 Gün İçinde Kargo
          listPrice,
          salesPrice,
          stockQuantity: p.stock,
          barcode: p.barcode || p.sku || p.id,
          images: p.images && p.images.length > 0 ? p.images : ["https://via.placeholder.com/500"],
          attributes,
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

    // Seçilen ürünlerin hata durumunu veritabanına kaydet
    if (productIds && productIds.length > 0) {
      for (const pid of productIds) {
        try {
          await (prisma as any).ciceksepetiProduct.upsert({
            where: { productId: pid },
            create: {
              productId: pid,
              isSynced: false,
              lastSyncError: error.message || "Hata oluştu",
              lastSyncedAt: new Date(),
            },
            update: {
              isSynced: false,
              lastSyncError: error.message || "Hata oluştu",
              lastSyncedAt: new Date(),
            },
          });
        } catch {}
      }
      revalidatePath("/admin/integrations/ciceksepeti/products");
    }

    return { success: false, error: error.message || "Senkronizasyon sırasında hata oluştu." };
  }
}

export async function getCiceksepetiProducts() {
  try {
    const products = await prisma.product.findMany({
      where: { isCiceksepetiActive: true },
      include: {
        ciceksepetiProduct: true,
        category: { select: { id: true, name: true, ciceksepetiCategoryId: true } },
        categories: { select: { id: true, name: true, ciceksepetiCategoryId: true } },
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

export async function getCiceksepetiCategoryAttributes(categoryId: string, ciceksepetiCategoryId: string) {
  try {
    const client = new CiceksepetiClient();
    const liveAttrs = await client.getCategoryAttributes(ciceksepetiCategoryId);

    const savedAttrs = await (prisma as any).ciceksepetiCategoryAttribute.findMany({
      where: { categoryId, ciceksepetiCategoryId },
    });

    const savedMap = new Map();
    for (const sa of savedAttrs) {
      savedMap.set(String(sa.attributeId), sa);
    }

    const merged = liveAttrs.map((attr) => {
      const saved = savedMap.get(String(attr.id));
      return {
        ...attr,
        selectedAttributeValueId: saved?.selectedAttributeValueId || null,
        customValue: saved?.customValue || "",
      };
    });

    return { success: true, attributes: merged };
  } catch (error: any) {
    console.error("getCiceksepetiCategoryAttributes error:", error);
    return { success: false, error: error.message || "Kategori özellikleri çekilemedi." };
  }
}

export async function saveCiceksepetiCategoryAttributes(
  categoryId: string,
  ciceksepetiCategoryId: string,
  mappings: {
    attributeId: string;
    attributeName: string;
    isRequired: boolean;
    selectedAttributeValueId?: string | null;
    selectedAttributeValueName?: string | null;
    customValue?: string | null;
    values?: any;
  }[]
) {
  try {
    for (const mapItem of mappings) {
      await (prisma as any).ciceksepetiCategoryAttribute.upsert({
        where: {
          id: `${categoryId}_${ciceksepetiCategoryId}_${mapItem.attributeId}`,
        },
        create: {
          id: `${categoryId}_${ciceksepetiCategoryId}_${mapItem.attributeId}`,
          categoryId,
          ciceksepetiCategoryId,
          attributeId: String(mapItem.attributeId),
          attributeName: mapItem.attributeName,
          isRequired: mapItem.isRequired ?? false,
          selectedAttributeValueId: mapItem.selectedAttributeValueId || null,
          selectedAttributeValueName: mapItem.selectedAttributeValueName || null,
          customValue: mapItem.customValue || null,
          values: mapItem.values || null,
        },
        update: {
          attributeName: mapItem.attributeName,
          isRequired: mapItem.isRequired ?? false,
          selectedAttributeValueId: mapItem.selectedAttributeValueId || null,
          selectedAttributeValueName: mapItem.selectedAttributeValueName || null,
          customValue: mapItem.customValue || null,
          values: mapItem.values || null,
        },
      });
    }

    revalidatePath("/admin/categories");
    return { success: true, message: "Kategori özellikleri başarıyla kaydedildi." };
  } catch (error: any) {
    console.error("saveCiceksepetiCategoryAttributes error:", error);
    return { success: false, error: error.message || "Özellikler kaydedilemedi." };
  }
}

// Ürün bazında Çiçeksepeti Kategori ID ayarlama
export async function setCiceksepetiProductCategory(productId: string, ciceksepetiCategoryId: string | null) {
  try {
    await (prisma as any).ciceksepetiProduct.upsert({
      where: { productId },
      create: {
        productId,
        ciceksepetiCategoryId: ciceksepetiCategoryId?.trim() || null,
      },
      update: {
        ciceksepetiCategoryId: ciceksepetiCategoryId?.trim() || null,
      },
    });
    revalidatePath("/admin/integrations/ciceksepeti");
    return { success: true, message: "Ürün Çiçeksepeti kategori ID'si güncellendi." };
  } catch (error: any) {
    console.error("setCiceksepetiProductCategory error:", error);
    return { success: false, error: error.message || "Kategori ID güncellenemedi." };
  }
}

// Toplu olarak birden fazla ürüne aynı Çiçeksepeti Kategori ID ata
export async function setBulkCiceksepetiProductCategory(productIds: string[], ciceksepetiCategoryId: string) {
  try {
    let updated = 0;
    for (const productId of productIds) {
      await (prisma as any).ciceksepetiProduct.upsert({
        where: { productId },
        create: {
          productId,
          ciceksepetiCategoryId: ciceksepetiCategoryId.trim(),
        },
        update: {
          ciceksepetiCategoryId: ciceksepetiCategoryId.trim(),
        },
      });
      updated++;
    }
    revalidatePath("/admin/integrations/ciceksepeti");
    return { success: true, message: `${updated} ürünün Çiçeksepeti kategorisi güncellendi.` };
  } catch (error: any) {
    console.error("setBulkCiceksepetiProductCategory error:", error);
    return { success: false, error: error.message || "Toplu kategori ataması başarısız." };
  }
}
