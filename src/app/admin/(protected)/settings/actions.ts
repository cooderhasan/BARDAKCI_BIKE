"use server";
import { requireAdmin } from "@/lib/admin-guard";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function updateSiteSettings(key: string, value: Record<string, string>) {
    await requireAdmin();
    try {
        await prisma.siteSettings.upsert({
            where: { key },
            update: { value: value as unknown as Prisma.InputJsonValue },
            create: { key, value: value as unknown as Prisma.InputJsonValue },
        });
        revalidatePath("/admin/settings");
        revalidatePath("/", "layout");
        return { success: true };
    } catch (error) {
        console.error("Settings update error:", error);
        throw error;
    }
}

export async function getSiteSettings(key: string) {
    await requireAdmin();
    const settings = await prisma.siteSettings.findUnique({
        where: { key },
    });
    return settings?.value as Record<string, unknown> | null;
}

export async function bulkUpdateAllProductsCriticalStockAction(criticalStock: number) {
    await requireAdmin();
    try {
        const val = Number(criticalStock) || 1;
        const result = await prisma.product.updateMany({
            data: {
                criticalStock: val
            }
        });
        revalidatePath("/admin/products");
        revalidatePath("/admin/settings");
        return {
            success: true,
            message: `Toplam ${result.count} ürünün kritik stok seviyesi ${val} olarak güncellendi.`
        };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}
