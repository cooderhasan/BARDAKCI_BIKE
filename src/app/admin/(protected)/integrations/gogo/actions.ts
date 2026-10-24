"use server";

import { requireAdmin } from "@/lib/admin-guard";
import { getGogoSettings, saveGogoSettings, runGogoStockSync, listSiteProductsNotInGogo, type GogoReport, type GogoSettings } from "@/lib/supplier-stock/gogo";
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

/** Sitede olup Gogo XML'inde olmayan ürünler: Excel'de açılan CSV (noktalı virgül, Türkçe karakterler için BOM) */
export async function exportProductsNotInGogo(): Promise<{ success: boolean; csv?: string; count?: number; error?: string }> {
    await requireAdmin();
    try {
        const { rows } = await listSiteProductsNotInGogo();
        const cell = (v: unknown) => {
            const t = String(v ?? "");
            return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
        };
        const lines = [
            ["Stok Kodu", "Ürün Adı", "Marka", "Stok", "Durum", "Mağaza", "Sebep"].join(";"),
            ...rows.map((r) => [r.sku, r.name, r.brand, r.stock, r.isActive ? "Aktif" : "Pasif", r.store === "BOTH" ? "Ortak" : "Motor", r.reason].map(cell).join(";")),
        ];
        return { success: true, csv: String.fromCharCode(0xfeff) + lines.join("\r\n"), count: rows.length };
    } catch (e: any) {
        return { success: false, error: e?.message || "Liste hazırlanamadı." };
    }
}
