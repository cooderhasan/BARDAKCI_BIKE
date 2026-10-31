"use server";
import { requireAdmin } from "@/lib/admin-guard";

import { prisma } from "@/lib/db";
import { safeRevalidatePath as revalidatePath } from "@/lib/safe-revalidate";
import { getStoreFilter, type ActiveStore } from "@/lib/store-helper";
import { getStoreSiteUrl } from "@/lib/site-urls";

// Bisiklet ve motor ayrı Merchant Center hesaplarına gider; sayfadaki istatistik ve toplu işlemler seçili mağazaya göre
const storeOf = (store: string): ActiveStore => (store === "MOTOR" ? "MOTOR" : "BIKE");

export async function getGoogleFeedUrls() {
  await requireAdmin();
  return {
    BIKE: `${getStoreSiteUrl("BIKE")}/api/feed/google`,
    MOTOR: `${getStoreSiteUrl("MOTOR")}/api/feed/google`,
  };
}

export async function getGoogleConfig() {
  await requireAdmin();
  try {
    const setting = await prisma.siteSettings.findUnique({
      where: { key: "google_merchant_config" },
    });
    return { success: true, data: setting ? (setting.value as any) : null };
  } catch {
    return { success: false, data: null };
  }
}

export async function saveGoogleConfig(prevState: any, formData: FormData) {
  await requireAdmin();
  try {
    const merchantId = formData.get("merchantId") as string;
    const siteUrl = formData.get("siteUrl") as string;

    await prisma.siteSettings.upsert({
      where: { key: "google_merchant_config" },
      update: { value: { merchantId, siteUrl } },
      create: { key: "google_merchant_config", value: { merchantId, siteUrl } },
    });

    revalidatePath("/admin/integrations/google");
    return { success: true, message: "Ayarlar kaydedildi." };
  } catch (error: any) {
    return { success: false, message: "Kayıt hatası: " + error.message };
  }
}

export async function updateCategoryGoogleMapping(
  categoryId: string,
  googleProductCategory: string | null
) {
  await requireAdmin();
  try {
    await prisma.category.update({
      where: { id: categoryId },
      data: { googleProductCategory: googleProductCategory || null } as any,
    });
    revalidatePath("/admin/integrations/google");
    revalidatePath("/admin/categories");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function getCategories(store: string = "BIKE") {
  await requireAdmin();
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    where: { isActive: true, store: getStoreFilter(storeOf(store)) },
  });
}

export async function getGoogleFeedStats(store: string = "BIKE") {
  await requireAdmin();
  const storeFilter = getStoreFilter(storeOf(store));
  try {
    const totalActive = await (prisma as any).product.count({
      where: { isActive: true, isGoogleActive: true, store: storeFilter },
    });
    const totalProducts = await (prisma as any).product.count({
      where: { isActive: true, store: storeFilter },
    });
    const totalWithCategory = await (prisma as any).product.count({
      where: {
        isActive: true,
        isGoogleActive: true,
        store: storeFilter,
        categories: {
          some: { googleProductCategory: { not: null } },
        },
      },
    });
    return { success: true, data: { totalActive, totalProducts, totalWithCategory } };
  } catch {
    return { success: true, data: { totalActive: 0, totalProducts: 0, totalWithCategory: 0 } };
  }
}

export async function bulkActivateGoogle(store: string = "BIKE") {
  await requireAdmin();
  try {
    const result = await (prisma as any).product.updateMany({
      where: { isActive: true, store: getStoreFilter(storeOf(store)) },
      data: { isGoogleActive: true },
    });
    revalidatePath("/admin/integrations/google");
    return { success: true, count: result.count, message: `${result.count} ürün Google Feed'e eklendi.` };
  } catch (error: any) {
    return { success: false, count: 0, message: "Hata: " + error.message };
  }
}

export async function bulkDeactivateGoogle(store: string = "BIKE") {
  await requireAdmin();
  try {
    // Ortak (BOTH) ürünler iki feed'de de var; bir mağazadan çıkarmak öbüründen de çıkarmasın diye sadece o mağazanın kendi ürünleri
    const result = await (prisma as any).product.updateMany({
      where: { isGoogleActive: true, store: storeOf(store) },
      data: { isGoogleActive: false },
    });
    revalidatePath("/admin/integrations/google");
    return { success: true, count: result.count, message: `${result.count} ürün Google Feed'den çıkarıldı.` };
  } catch (error: any) {
    return { success: false, count: 0, message: "Hata: " + error.message };
  }
}

export async function bulkMapCategoriesToGoogle(store: string = "BIKE") {
  await requireAdmin();
  try {
    // Sadece seçili mağazanın kendi kategorileri (önceden motor kategorileri de Bisikletler'e eşleniyordu)
    const isMotor = storeOf(store) === "MOTOR";
    const targetGoogleCategory = isMotor ? "5613" : "1026"; // 5613: Taşıt Parçaları ve Aksesuarları, 1026: Bisikletler
    const result = await prisma.category.updateMany({
      where: { store: storeOf(store) },
      data: { googleProductCategory: targetGoogleCategory },
    });

    revalidatePath("/admin/integrations/google");
    return {
      success: true,
      message: `${isMotor ? "Motor" : "Bisiklet"} kategorileri (${result.count} adet) ${isMotor ? "Taşıt Parçaları ve Aksesuarları (5613)" : "Bisikletler (1026)"} olarak eşleştirildi.`,
    };
  } catch (error: any) {
    return { success: false, message: "Hata: " + error.message };
  }
}

