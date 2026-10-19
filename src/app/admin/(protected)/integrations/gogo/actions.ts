"use server";

import { requireAdmin } from "@/lib/admin-guard";
import { getGogoSettings, saveGogoSettings, runGogoStockSync, type GogoReport, type GogoSettings } from "@/lib/supplier-stock/gogo";
import { revalidatePath } from "next/cache";

export async function getGogoConfig(): Promise<GogoSettings> {
    await requireAdmin();
    return getGogoSettings();
}

export async function updateGogoConfig(input: { url: string; enabled: boolean }): Promise<{ success: boolean; error?: string }> {
    await requireAdmin();
    const url = (input.url || "").trim();
    if (url && !/^https?:\/\//i.test(url)) return { success: false, error: "Geçerli bir XML bağlantısı girin (https://...)." };
    if (input.enabled && !url) return { success: false, error: "Otomatik çalışma için önce XML bağlantısını girin." };
    await saveGogoSettings({ url, enabled: !!input.enabled });
    revalidatePath("/admin/integrations/gogo");
    return { success: true };
}

/** dryRun=true: sadece ne değişeceğini gösterir; false: stokları yazar ve pazaryerlerine gönderir */
export async function runGogoSync(dryRun: boolean): Promise<{ success: boolean; report?: GogoReport; error?: string }> {
    await requireAdmin();
    try {
        const report = await runGogoStockSync({ dryRun });
        revalidatePath("/admin/integrations/gogo");
        return { success: true, report };
    } catch (e: any) {
        return { success: false, error: e?.message || "Gogo stok güncellemesi yapılamadı." };
    }
}
