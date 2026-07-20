"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export async function getCategories() {
    return prisma.category.findMany({
        orderBy: { order: "asc" },
        include: {
            _count: {
                select: { products: true },
            },
        },
    });
}

export async function createCategory(data: { name: string; slug: string; order?: number; parentId?: string | null; imageUrl?: string; menuImageUrl?: string; isFeatured?: boolean; isInHeader?: boolean; headerOrder?: number; trendyolCategoryId?: number | null; n11CategoryId?: number | null; hbCategoryId?: string | null; idefixCategoryId?: number | null; googleProductCategory?: string | null; description?: string }) {
    try {
        await prisma.category.create({
            data: {
                name: data.name,
                slug: data.slug,
                order: data.order ?? 0,
                parentId: data.parentId || null,
                imageUrl: data.imageUrl,
                menuImageUrl: data.menuImageUrl,
                isFeatured: data.isFeatured ?? false,
                isInHeader: data.isInHeader ?? false,
                headerOrder: data.headerOrder ?? 0,
                trendyolCategoryId: data.trendyolCategoryId ?? null,
                n11CategoryId: data.n11CategoryId ?? null,
                hbCategoryId: data.hbCategoryId ? String(data.hbCategoryId) : null,
                idefixCategoryId: data.idefixCategoryId ?? null,
                googleProductCategory: data.googleProductCategory ?? null,
                description: data.description ?? null,
            },
        });
        revalidatePath("/admin/categories");
        revalidatePath("/");
        return { success: true, message: "Kategori oluşturuldu." };
    } catch (error: any) {
        console.error("createCategory error:", error);
        return { success: false, message: "Kategori oluşturulamadı: " + error.message };
    }
}

export async function updateCategory(id: string, data: { name?: string; slug?: string; order?: number; isActive?: boolean; parentId?: string | null; imageUrl?: string; menuImageUrl?: string; isFeatured?: boolean; isInHeader?: boolean; headerOrder?: number; trendyolCategoryId?: number | null; n11CategoryId?: number | null; hbCategoryId?: string | null; idefixCategoryId?: number | null; googleProductCategory?: string | null; description?: string | null }) {
    try {
        await prisma.category.update({
            where: { id },
            data: {
                ...data,
                hbCategoryId: data.hbCategoryId ? String(data.hbCategoryId) : (data.hbCategoryId === null ? null : undefined),
                parentId: data.parentId === undefined ? undefined : (data.parentId || null),
            },
        });
        revalidatePath("/admin/categories");
        revalidatePath("/");
        return { success: true, message: "Kategori güncellendi." };
    } catch (error: any) {
        console.error("updateCategory error:", error);
        return { success: false, message: "Kategori güncellenemedi: " + error.message };
    }
}

export async function deleteCategory(id: string) {
    await prisma.category.delete({
        where: { id },
    });
    revalidatePath("/admin/categories");
    revalidatePath("/");
}

export async function toggleCategoryStatus(id: string, isActive: boolean) {
    await prisma.category.update({
        where: { id },
        data: { isActive },
    });
    revalidatePath("/admin/categories");
}

export async function updateCategoriesSidebarOrder(updates: { id: string; order: number }[]) {
    await prisma.$transaction(
        updates.map((update) =>
            prisma.category.update({
                where: { id: update.id },
                data: { order: update.order },
            })
        )
    );
    revalidatePath("/admin/categories");
    revalidatePath("/");
}

export async function updateCategoriesHeaderOrder(updates: { id: string; headerOrder: number }[]) {
    await prisma.$transaction(
        updates.map((update) =>
            prisma.category.update({
                where: { id: update.id },
                data: { headerOrder: update.headerOrder },
            })
        )
    );
    revalidatePath("/admin/categories");
    revalidatePath("/");
}
