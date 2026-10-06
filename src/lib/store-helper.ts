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
  seoDescription?: string;
  logoUrl: string;
  darkLogoUrl: string;
  faviconUrl?: string;
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
  siteTitle: "Bardakcı Bike",
  seoDescription: "Orijinal Bisan, Corelli, Mosso, Ümit bisiklet modelleri, bisiklet yedek parça ve aksesuarları.",
  logoUrl: "/logo.png",
  darkLogoUrl: "/logo-dark.png",
  phone: "0554 014 41 42",
  email: "vitrinmoto@gmail.com",
  address: "Yazır Mahallesi Şafak Cad. No:32B Selçuklu / Konya",
  primaryColor: "#17457C",
  accentColor: "#F27A1A",
  isFreeShipping: true, // Bisiklet için ücretsiz kargo
};

const DEFAULT_MOTOR_SETTINGS: StoreThemeSettings = {
  store: "MOTOR",
  siteTitle: "Moto Vitrin",
  seoDescription: "Orijinal motosiklet yedek parça, kask ve aksesuarları.",
  logoUrl: "/logo-motor.png",
  darkLogoUrl: "/logo-motor-dark.png",
  phone: "0554 014 41 42",
  email: "vitrinmoto@gmail.com",
  address: "Yazır Mahallesi Şafak Cad. No:32B Selçuklu / Konya",
  primaryColor: "#E53935", // Motosiklet konsepti kırmızı/turuncu tonları
  accentColor: "#FF5722",
  isFreeShipping: false, // Motor için desi bazlı kargo
};

import { getSiteSettings } from "@/lib/settings";

/**
 * Veritabanından mağazaya özel ayarları çeker, yoksa varsayılan veya genel ayarları döner.
 */
export async function getStoreSettings(storeType: ActiveStore): Promise<StoreThemeSettings> {
  let generalLogo = "";
  let generalFavicon = "";
  let generalSiteName = "";
  let generalSeoDescription = "";
  let generalPhone = "";
  let generalEmail = "";
  let generalAddress = "";

  try {
    const general = await getSiteSettings();
    const isB2B = (val?: string) => !val || val.includes("b2b.com") || val.includes("B2B") || val.includes("555 0000") || val === "İstanbul, Türkiye";

    generalLogo = general.logoUrl || general.darkLogoUrl || "";
    generalFavicon = general.faviconUrl || "";
    if (!isB2B(general.siteName)) generalSiteName = general.siteName || "";
    if (!isB2B(general.seoDescription)) generalSeoDescription = general.seoDescription || "";
    if (!isB2B(general.phone)) generalPhone = general.phone || "";
    if (!isB2B(general.email)) generalEmail = general.email || "";
    if (!isB2B(general.address)) generalAddress = general.address || "";
  } catch {}

  const defaults: StoreThemeSettings = storeType === "MOTOR" ? DEFAULT_MOTOR_SETTINGS : {
    ...DEFAULT_BIKE_SETTINGS,
    siteTitle: generalSiteName || DEFAULT_BIKE_SETTINGS.siteTitle,
    seoDescription: generalSeoDescription || DEFAULT_BIKE_SETTINGS.seoDescription,
    logoUrl: generalLogo || DEFAULT_BIKE_SETTINGS.logoUrl,
    phone: generalPhone || DEFAULT_BIKE_SETTINGS.phone,
    email: generalEmail || DEFAULT_BIKE_SETTINGS.email,
    address: generalAddress || DEFAULT_BIKE_SETTINGS.address,
  };

  try {
    const dbSettings = await (prisma as any).storeSettings.findUnique({
      where: { store: storeType },
    });

    if (!dbSettings) return defaults;

    return {
      store: storeType,
      siteTitle: dbSettings.siteTitle || defaults.siteTitle,
      seoDescription: dbSettings.seoDescription || defaults.seoDescription,
      logoUrl: dbSettings.logoUrl || generalLogo || defaults.logoUrl,
      darkLogoUrl: dbSettings.darkLogoUrl || defaults.darkLogoUrl,
      faviconUrl: dbSettings.faviconUrl || generalFavicon || "",
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
    return defaults;
  }
}
