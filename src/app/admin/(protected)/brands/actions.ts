"use server";

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

export async function createBrand(data: { name: string; logoUrl?: string; store?: StoreType; trendyolBrandId?: number | null; n11BrandId?: number | null; hbBrandId?: string | null; idefixBrandId?: string | number | null }) {
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
        },
    });
    revalidatePath("/admin/brands");
}

export async function updateBrand(id: string, data: { name?: string; logoUrl?: string; store?: StoreType; isActive?: boolean; trendyolBrandId?: number | null; n11BrandId?: number | null; hbBrandId?: string | null; idefixBrandId?: string | number | null }) {
    const updateData: any = { ...data };
    if (data.name) {
        updateData.slug = slugify(data.name);
    }
    if (data.idefixBrandId !== undefined) {
        updateData.idefixBrandId = data.idefixBrandId ? String(data.idefixBrandId) : null;
    }
    await prisma.brand.update({
        where: { id },
        data: updateData,
    });
    revalidatePath("/admin/brands");
}

export async function deleteBrand(id: string) {
    await prisma.brand.delete({
        where: { id },
    });
    revalidatePath("/admin/brands");
}
