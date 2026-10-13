"use server";
import { requireAdmin } from "@/lib/admin-guard";

import { prisma } from "@/lib/db";
import { safeRevalidatePath as revalidatePath } from "@/lib/safe-revalidate";

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

export async function getCategories() {
  await requireAdmin();
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    where: { isActive: true },
  });
}

export async function getGoogleFeedStats() {
  await requireAdmin();
  try {
    const totalActive = await (prisma as any).product.count({
      where: { isActive: true, isGoogleActive: true },
    });
    const totalProducts = await (prisma as any).product.count({
      where: { isActive: true },
    });
    const totalWithCategory = await (prisma as any).product.count({
      where: {
        isActive: true,
        isGoogleActive: true,
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

export async function bulkActivateGoogle() {
  await requireAdmin();
  try {
    const result = await (prisma as any).product.updateMany({
      where: { isActive: true },
      data: { isGoogleActive: true },
    });
    revalidatePath("/admin/integrations/google");
    return { success: true, count: result.count, message: `${result.count} ürün Google Feed'e eklendi.` };
  } catch (error: any) {
    return { success: false, count: 0, message: "Hata: " + error.message };
  }
}

export async function bulkDeactivateGoogle() {
  await requireAdmin();
  try {
    const result = await (prisma as any).product.updateMany({
      where: { isGoogleActive: true },
      data: { isGoogleActive: false },
    });
    revalidatePath("/admin/integrations/google");
    return { success: true, count: result.count, message: `${result.count} ürün Google Feed'den çıkarıldı.` };
  } catch (error: any) {
    return { success: false, count: 0, message: "Hata: " + error.message };
  }
}

export async function bulkMapCategoriesToGoogle() {
  await requireAdmin();
  try {
    const categories = await prisma.category.findMany();
    let updatedCount = 0;

    for (const cat of categories) {
      const targetGoogleCategory = "1026"; // Doğrudan Bisikletler (1026) kategorisi

      await prisma.category.update({
        where: { id: cat.id },
        data: { googleProductCategory: targetGoogleCategory }
      });
      updatedCount++;
    }

    revalidatePath("/admin/integrations/google");
    return { success: true, message: `Tüm kategoriler (${updatedCount} adet) başarıyla doğrudan Bisikletler (1026) olarak eşleştirildi.` };
  } catch (error: any) {
    return { success: false, message: "Hata: " + error.message };
  }
}

