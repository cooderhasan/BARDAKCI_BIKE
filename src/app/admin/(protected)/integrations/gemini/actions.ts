"use server";

import { prisma } from "@/lib/db";
import { safeRevalidatePath as revalidatePath } from "@/lib/safe-revalidate";

export async function getGeminiConfig() {
  try {
    const config = await prisma.geminiConfig.findFirst();
    return { success: true, data: config };
  } catch (error) {
    return { success: false, error: "Ayarlar alınamadı" };
  }
}

export async function saveGeminiConfig(formData: FormData) {
  const provider = formData.get("provider") as string;
  const apiKey = formData.get("apiKey") as string;
  const openRouterApiKey = formData.get("openRouterApiKey") as string;
  const openRouterModel = (formData.get("openRouterModel") as string) || "qwen/qwen-3.6-plus";
  const isActive = formData.get("isActive") === "on";

  try {
    const existing = await prisma.geminiConfig.findFirst();

    if (existing) {
      await prisma.geminiConfig.update({
        where: { id: existing.id },
        data: { 
            provider, 
            apiKey, 
            openRouterApiKey, 
            openRouterModel, 
            isActive 
        },
      });
    } else {
      await prisma.geminiConfig.create({
        data: { 
            provider, 
            apiKey, 
            openRouterApiKey, 
            openRouterModel, 
            isActive 
        },
      });
    }

    revalidatePath("/admin/integrations/gemini");
    return { success: true, message: "Ayarlar kaydedildi" };
  } catch (error) {
    console.error("Save AI Config Error:", error);
    return { success: false, error: "Kaydedilirken bir hata oluştu" };
  }
}
