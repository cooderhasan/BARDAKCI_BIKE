"use server";
import { requireAdmin } from "@/lib/admin-guard";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ş/g, "s")
        .replace(/ı/g, "i")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export async function getBrands() {
    await requireAdmin();
    return prisma.brand.findMany({
        orderBy: { name: "asc" },
        include: {
            _count: {
                select: { products: true },
            },
        },
    });
}

import { StoreType } from "@prisma/client";

export async function createBrand(data: { name: string; logoUrl?: string; store?: StoreType; trendyolBrandId?: number | null; n11BrandId?: number | null; hbBrandId?: string | null; idefixBrandId?: string | number | null; pazaramaBrandId?: string | number | null; manufacturerFirmId?: string | null; importerFirmId?: string | null }) {
    await requireAdmin();
    await prisma.brand.create({
        data: {
            name: data.name,
            slug: slugify(data.name),
            logoUrl: data.logoUrl,
            store: data.store || "BIKE",
            trendyolBrandId: data.trendyolBrandId ?? null,
            n11BrandId: data.n11BrandId ?? null,
            hbBrandId: data.hbBrandId ?? null,
            idefixBrandId: data.idefixBrandId ? String(data.idefixBrandId) : null,
            pazaramaBrandId: data.pazaramaBrandId ? String(data.pazaramaBrandId) : null,
            manufacturerFirmId: data.manufacturerFirmId || null,
            importerFirmId: data.importerFirmId || null,
        },
    });
    revalidatePath("/admin/brands");
}

export async function updateBrand(id: string, data: { name?: string; logoUrl?: string; store?: StoreType; isActive?: boolean; trendyolBrandId?: number | null; n11BrandId?: number | null; hbBrandId?: string | null; idefixBrandId?: string | number | null; pazaramaBrandId?: string | number | null; manufacturerFirmId?: string | null; importerFirmId?: string | null }) {
    await requireAdmin();
    const updateData: any = { ...data };
    if (data.manufacturerFirmId !== undefined) updateData.manufacturerFirmId = data.manufacturerFirmId || null;
    if (data.importerFirmId !== undefined) updateData.importerFirmId = data.importerFirmId || null;
    if (data.name) {
        updateData.slug = slugify(data.name);
    }
    if (data.idefixBrandId !== undefined) {
        updateData.idefixBrandId = data.idefixBrandId ? String(data.idefixBrandId) : null;
    }
    if (data.pazaramaBrandId !== undefined) {
        updateData.pazaramaBrandId = data.pazaramaBrandId ? String(data.pazaramaBrandId) : null;
    }
    await prisma.brand.update({
        where: { id },
        data: updateData,
    });
    revalidatePath("/admin/brands");
}

export async function deleteBrand(id: string) {
    await requireAdmin();
    await prisma.brand.delete({
        where: { id },
    });
    revalidatePath("/admin/brands");
}

// --- İktisadi işletmeci firmaları (imalatçı / ithalatçı) ---

export async function getOperatorFirms() {
    await requireAdmin();
    return prisma.operatorFirm.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { manufacturerOf: true, importerOf: true } } },
    });
}

function cleanFirm(data: { name: string; address: string; email: string }) {
    const name = (data.name || "").trim();
    const address = (data.address || "").trim();
    const email = (data.email || "").trim();
    if (!name || !address || !email) throw new Error("Ünvan, adres ve e-posta zorunludur.");
    return { name, address, email };
}

export async function saveOperatorFirm(id: string | null, data: { name: string; address: string; email: string }) {
    await requireAdmin();
    try {
        const clean = cleanFirm(data);
        const firm = id
            ? await prisma.operatorFirm.update({ where: { id }, data: clean })
            : await prisma.operatorFirm.create({ data: clean });
        revalidatePath("/admin/brands");
        return { success: true, firm };
    } catch (e: any) {
        return { success: false, message: e?.message || "Firma kaydedilemedi." };
    }
}

export async function deleteOperatorFirm(id: string) {
    await requireAdmin();
    // Markalardaki bağlantı onDelete: SetNull ile boşalır
    await prisma.operatorFirm.delete({ where: { id } });
    revalidatePath("/admin/brands");
    return { success: true };
}

/** Pazaryeri gönderim formları için: ürünün markasına tanımlı imalatçı / ithalatçı */
export async function getProductOperators(productId: string) {
    await requireAdmin();
    const { productOperatorsOf } = await import("@/lib/operator-firms");
    return productOperatorsOf(productId);
}
