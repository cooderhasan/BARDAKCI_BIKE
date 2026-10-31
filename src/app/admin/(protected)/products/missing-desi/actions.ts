"use server";

import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type MissingDesiProduct = {
    id: string;
    name: string;
    sku: string | null;
    image: string | null;
    category: string;
    store: string;
    stock: number;
};

/**
 * Desisi girilmemiş aktif ürünler. Sepetteki kargo desi, ağırlık ve ölçü/3000'in en büyüğünden hesaplanır;
 * üçü de boş ve ürün "Ücretsiz Kargo" işaretsizse kargo 0 çıkıyor, siparişte kargoyu firma ödüyor.
 * store: o sitenin ürünleri (kendi + iki sitede ortak olanlar).
 */
export async function getMissingDesiProducts(store: "BIKE" | "MOTOR"): Promise<MissingDesiProduct[]> {
    await requireAdmin();

    const rows = await prisma.product.findMany({
        where: {
            isActive: true,
            isFreeShipping: false,
            store: { in: [store, "BOTH"] },
            AND: [
                { OR: [{ desi: null }, { desi: { lte: 0 } }] },
                { OR: [{ weight: null }, { weight: { lte: 0 } }] },
            ],
        },
        select: {
            id: true, name: true, sku: true, images: true, store: true, stock: true,
            width: true, height: true, length: true,
            category: { select: { name: true } },
            categories: { select: { name: true } },
            variants: { select: { stock: true } },
        },
    });

    return rows
        .filter((p) => Number(p.width || 0) * Number(p.height || 0) * Number(p.length || 0) <= 0)
        .map((p) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            image: p.images?.[0] || null,
            // Kategoriler çoklu ilişkide (categories); categoryId eski tekli alan, yeni ürünlerde boş
            category: p.categories.map((c) => c.name).join(", ") || p.category?.name || "-",
            store: p.store,
            // Varyantlı üründe ana ürün stoğu 0 olabilir; satılabilir adet varyantların toplamı
            stock: p.variants.length ? p.variants.reduce((a, v) => a + (v.stock || 0), 0) : p.stock,
        }))
        .sort((a, b) => b.stock - a.stock || a.name.localeCompare(b.name, "tr"));
}

/** Seçilen ürünlere desi yazar; sadece hâlâ desisi boş olanlara (bu arada elle girilmiş desiyi ezmez) */
export async function setDesiForProducts(ids: string[], desi: number) {
    await requireAdmin();

    if (!Array.isArray(ids) || ids.length === 0) return { success: false, message: "Ürün seçilmedi." };
    if (!Number.isFinite(desi) || desi <= 0 || desi > 1000) return { success: false, message: "Desi 0'dan büyük olmalı." };

    const res = await prisma.product.updateMany({
        where: { id: { in: ids }, OR: [{ desi: null }, { desi: { lte: 0 } }] },
        data: { desi },
    });

    revalidatePath("/admin/products/missing-desi");
    return { success: true, message: `${res.count} ürüne ${desi} desi yazıldı.` };
}
