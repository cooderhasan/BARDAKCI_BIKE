import { prisma } from "@/lib/db";

const TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Pazaryeri kategori listeleri için 24 saatlik veritabanı önbelleği (SiteSettings `catcache_<anahtar>`).
 * Önceden kategoriler sayfası her aramada (Trendyol/N11'de her harfte) tüm listeyi pazaryerinden çekiyordu.
 * - Taze kayıt varsa pazaryerine bağlanılmaz.
 * - Süre dolduysa yenilenir; pazaryerine ulaşılamazsa eski kayıt kullanılır.
 */
export async function cachedCategoryResult<T>(key: string, live: () => Promise<T>, isGood: (v: T) => boolean): Promise<T> {
    const settingsKey = `catcache_${key}`;
    let cached: { value: T; updatedAt: string } | null = null;
    try {
        const row = await prisma.siteSettings.findUnique({ where: { key: settingsKey } });
        cached = (row?.value as any) || null;
    } catch {
        cached = null;
    }
    const fresh = cached?.updatedAt && Date.now() - new Date(cached.updatedAt).getTime() < TTL_MS;
    if (cached && fresh && isGood(cached.value)) return cached.value;

    const result = await live();
    if (isGood(result)) {
        const stored = { value: result, updatedAt: new Date().toISOString() };
        await prisma.siteSettings
            .upsert({ where: { key: settingsKey }, create: { key: settingsKey, value: stored as any }, update: { value: stored as any } })
            .catch((e) => console.warn(`Kategori önbelleği yazılamadı (${key}):`, e?.message));
        return result;
    }
    // Pazaryerinden alınamadı: eski kayıt varsa onu kullan
    if (cached && isGood(cached.value)) return cached.value;
    return result;
}
