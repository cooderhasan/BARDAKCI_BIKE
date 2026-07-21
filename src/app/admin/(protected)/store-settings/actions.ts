"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { StoreType } from "@prisma/client";

export async function getStoreSettingsData(store: "BIKE" | "MOTOR") {
  try {
    const settings = await (prisma as any).storeSettings.findUnique({
      where: { store },
    });
    return { success: true, data: settings };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function saveStoreSettingsData(
  store: "BIKE" | "MOTOR",
  data: {
    siteTitle?: string;
    logoUrl?: string;
    darkLogoUrl?: string;
    faviconUrl?: string;
    phone?: string;
    email?: string;
    address?: string;
    primaryColor?: string;
    accentColor?: string;
    googleAnalyticsId?: string;
    metaPixelId?: string;
  }
) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
    return { success: false, message: "Yetkisiz erişim." };
  }

  try {
    await (prisma as any).storeSettings.upsert({
      where: { store },
      update: {
        siteTitle: data.siteTitle || undefined,
        logoUrl: data.logoUrl || undefined,
        darkLogoUrl: data.darkLogoUrl || undefined,
        faviconUrl: data.faviconUrl || undefined,
        phone: data.phone || undefined,
        email: data.email || undefined,
        address: data.address || undefined,
        primaryColor: data.primaryColor || undefined,
        accentColor: data.accentColor || undefined,
        googleAnalyticsId: data.googleAnalyticsId || undefined,
        metaPixelId: data.metaPixelId || undefined,
      },
      create: {
        store: store as StoreType,
        siteTitle: data.siteTitle || (store === "MOTOR" ? "Motovitrin" : "Bardakçı Bisiklet"),
        logoUrl: data.logoUrl || undefined,
        darkLogoUrl: data.darkLogoUrl || undefined,
        faviconUrl: data.faviconUrl || undefined,
        phone: data.phone || undefined,
        email: data.email || undefined,
        address: data.address || undefined,
        primaryColor: data.primaryColor || (store === "MOTOR" ? "#E53935" : "#17457C"),
        accentColor: data.accentColor || (store === "MOTOR" ? "#FF5722" : "#F27A1A"),
        googleAnalyticsId: data.googleAnalyticsId || undefined,
        metaPixelId: data.metaPixelId || undefined,
      },
    });

    revalidatePath("/");
    revalidatePath("/admin/store-settings");

    return { success: true, message: `${store === "MOTOR" ? "Motovitrin" : "Bardakçı Bisiklet"} ayarları başarıyla kaydedildi.` };
  } catch (error: any) {
    console.error("saveStoreSettingsData error:", error);
    return { success: false, message: "Ayarlar kaydedilirken hata oluştu: " + error.message };
  }
}
