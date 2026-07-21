import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { StoreType } from "@prisma/client";

export type ActiveStore = "BIKE" | "MOTOR";

/**
 * Gelen isteğin alan adına (host) göre aktif mağazayı tespit eder.
 * motovitrin.com, motor.bardakcibike.com.tr, motovitrin.bardakcibike.com.tr vb. için MOTOR,
 * diğer tüm alan adları için BIKE döner.
 */
export async function getStoreType(): Promise<ActiveStore> {
  try {
    const headersList = await headers();
    const host = (headersList.get("host") || "").toLowerCase();

    if (
      host.includes("motovitrin") ||
      host.startsWith("motor.") ||
      host.includes("motor-")
    ) {
      return "MOTOR";
    }
  } catch (error) {
    console.error("[STORE-HELPER] Host tespiti hatası:", error);
  }
  return "BIKE";
}

/**
 * Prisma sorguları için mağaza filtresi oluşturur.
 * Mağaza 'BIKE' ise [BIKE, BOTH], 'MOTOR' ise [MOTOR, BOTH] ürün/kategori/afişlerini getirir.
 */
export function getStoreFilter(storeType: ActiveStore) {
  return { in: [storeType, "BOTH" as StoreType] };
}

export interface StoreThemeSettings {
  store: ActiveStore;
  siteTitle: string;
  logoUrl: string;
  darkLogoUrl: string;
  phone: string;
  email: string;
  address: string;
  primaryColor: string;
  accentColor: string;
  isFreeShipping: boolean; // Bisiklet: true (ücretsiz), Motor: false (desi bazlı)
  googleAnalyticsId?: string;
  metaPixelId?: string;
}

const DEFAULT_BIKE_SETTINGS: StoreThemeSettings = {
  store: "BIKE",
  siteTitle: "Bardakçı Bisiklet",
  logoUrl: "/logo.png",
  darkLogoUrl: "/logo-dark.png",
  phone: "+90 554 014 41 42",
  email: "info@bardakcibike.com.tr",
  address: "Horozluhan Mah. Ayça Sk. No:62 Selçuklu / Konya",
  primaryColor: "#17457C",
  accentColor: "#F27A1A",
  isFreeShipping: true, // Bisiklet için ücretsiz kargo
};

const DEFAULT_MOTOR_SETTINGS: StoreThemeSettings = {
  store: "MOTOR",
  siteTitle: "Motovitrin - Motosiklet Yedek Parça & Aksesuar",
  logoUrl: "/logo-motor.png",
  darkLogoUrl: "/logo-motor-dark.png",
  phone: "+90 554 014 41 42",
  email: "info@motovitrin.com",
  address: "Horozluhan Mah. Ayça Sk. No:62 Selçuklu / Konya",
  primaryColor: "#E53935", // Motosiklet konsepti kırmızı/turuncu tonları
  accentColor: "#FF5722",
  isFreeShipping: false, // Motor için desi bazlı kargo
};

/**
 * Veritabanından mağazaya özel ayarları çeker, yoksa varsayılan ayarları döner.
 */
export async function getStoreSettings(storeType: ActiveStore): Promise<StoreThemeSettings> {
  try {
    const dbSettings = await (prisma as any).storeSettings.findUnique({
      where: { store: storeType },
    });

    const defaults = storeType === "MOTOR" ? DEFAULT_MOTOR_SETTINGS : DEFAULT_BIKE_SETTINGS;

    if (!dbSettings) return defaults;

    return {
      store: storeType,
      siteTitle: dbSettings.siteTitle || defaults.siteTitle,
      logoUrl: dbSettings.logoUrl || defaults.logoUrl,
      darkLogoUrl: dbSettings.darkLogoUrl || defaults.darkLogoUrl,
      phone: dbSettings.phone || defaults.phone,
      email: dbSettings.email || defaults.email,
      address: dbSettings.address || defaults.address,
      primaryColor: dbSettings.primaryColor || defaults.primaryColor,
      accentColor: dbSettings.accentColor || defaults.accentColor,
      isFreeShipping: storeType === "BIKE", // Bisiklet ücretsiz, motor desi bazlı
      googleAnalyticsId: dbSettings.googleAnalyticsId,
      metaPixelId: dbSettings.metaPixelId,
    };
  } catch {
    return storeType === "MOTOR" ? DEFAULT_MOTOR_SETTINGS : DEFAULT_BIKE_SETTINGS;
  }
}
