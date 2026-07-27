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
        // Tüm olası kaynaklardan Çiçeksepeti Kategori ID'sini bul
        const productCatName = p.category?.name || p.categories?.[0]?.name || "Bilinmeyen";
        const productCatId = p.categoryId || p.category?.id || p.categories?.[0]?.id;

        console.log(`[CS-SYNC] Ürün: "${p.name}", categoryId: ${p.categoryId}, category?.id: ${p.category?.id}, category?.name: ${p.category?.name}, category?.ciceksepetiCategoryId: ${p.category?.ciceksepetiCategoryId}, categories count: ${p.categories?.length || 0}, categories[0]?.name: ${p.categories?.[0]?.name}, categories[0]?.ciceksepetiCategoryId: ${p.categories?.[0]?.ciceksepetiCategoryId}`);

        let rawCatId: string | null = null;

        // 1) Ürünün doğrudan kategorisi
        if (!rawCatId && p.category?.ciceksepetiCategoryId) {
          rawCatId = p.category.ciceksepetiCategoryId;
          console.log(`[CS-SYNC] -> Adım 1: category.ciceksepetiCategoryId = ${rawCatId}`);
        }
        // 2) Ürünün categories[] dizisindeki ilk kategori
        if (!rawCatId && p.categories?.[0]?.ciceksepetiCategoryId) {
          rawCatId = p.categories[0].ciceksepetiCategoryId;
          console.log(`[CS-SYNC] -> Adım 2: categories[0].ciceksepetiCategoryId = ${rawCatId}`);
        }
        // 3) Üst kategoriler (parent chain)
        if (!rawCatId && p.category?.parent?.ciceksepetiCategoryId) {
          rawCatId = p.category.parent.ciceksepetiCategoryId;
          console.log(`[CS-SYNC] -> Adım 3a: category.parent.ciceksepetiCategoryId = ${rawCatId}`);
        }
        if (!rawCatId && p.categories?.[0]?.parent?.ciceksepetiCategoryId) {
          rawCatId = p.categories[0].parent.ciceksepetiCategoryId;
          console.log(`[CS-SYNC] -> Adım 3b: categories[0].parent.ciceksepetiCategoryId = ${rawCatId}`);
        }
        // 4) DB'den tam zincir taraması: ürünün kategorisinden başlayarak tüm üst ve alt kategorileri tara
        if (!rawCatId && productCatId) {
          console.log(`[CS-SYNC] -> Adım 4: DB zincir taraması başlıyor. productCatId = ${productCatId}`);
          // Üst kategorileri tara (kendisi dahil)
          let currentId: string | null = productCatId;
          for (let depth = 0; depth < 5 && currentId && !rawCatId; depth++) {
            const cat = await prisma.category.findUnique({
              where: { id: currentId },
              select: { ciceksepetiCategoryId: true, parentId: true, name: true },
            });
            console.log(`[CS-SYNC]    Derinlik ${depth}: id=${currentId}, name=${(cat as any)?.name}, ciceksepetiCategoryId=${cat?.ciceksepetiCategoryId}, parentId=${cat?.parentId}`);
            if (cat?.ciceksepetiCategoryId) {
              rawCatId = cat.ciceksepetiCategoryId;
            } else {
              currentId = cat?.parentId || null;
            }
          }
          // Alt kategorileri tara
          if (!rawCatId) {
            const childCat = await prisma.category.findFirst({
              where: {
                OR: [
                  { parentId: productCatId, ciceksepetiCategoryId: { not: null } },
                  { parent: { parentId: productCatId }, ciceksepetiCategoryId: { not: null } },
                ],
              },
              select: { ciceksepetiCategoryId: true, name: true },
            });
            console.log(`[CS-SYNC]    Alt kategori taraması: ${childCat ? `Bulundu: ${(childCat as any).name} = ${childCat.ciceksepetiCategoryId}` : "Bulunamadı"}`);
            if (childCat?.ciceksepetiCategoryId) {
              rawCatId = childCat.ciceksepetiCategoryId;
            }
          }
        }

        if (!rawCatId) {
          console.error(`[CS-SYNC] HATA: "${p.name}" için hiçbir aşamada ciceksepetiCategoryId bulunamadı!`);
          throw new Error(`'${p.name}' ürünü (Kategori: "${productCatName}", ID: ${productCatId || "yok"}) için Çiçeksepeti Kategori ID tanımlanmamış. Lütfen "${productCatName}" kategorisine Çiçeksepeti eşleştirmesi yapın.`);
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

