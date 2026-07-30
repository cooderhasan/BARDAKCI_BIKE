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

export async function createCategory(data: { name: string; slug: string; store?: "BIKE" | "MOTOR" | "BOTH"; order?: number; parentId?: string | null; imageUrl?: string; menuImageUrl?: string; isFeatured?: boolean; isInHeader?: boolean; headerOrder?: number; trendyolCategoryId?: number | null; n11CategoryId?: number | null; hbCategoryId?: string | null; idefixCategoryId?: string | number | null; pazaramaCategoryId?: string | number | null; ciceksepetiCategoryId?: string | number | null; googleProductCategory?: string | null; description?: string }) {
    try {
        await prisma.category.create({
            data: {
                name: data.name,
                slug: data.slug,
                store: data.store || "BIKE",
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
                idefixCategoryId: data.idefixCategoryId ? String(data.idefixCategoryId) : null,
                pazaramaCategoryId: data.pazaramaCategoryId ? String(data.pazaramaCategoryId) : null,
                ciceksepetiCategoryId: (data as any).ciceksepetiCategoryId ? String((data as any).ciceksepetiCategoryId) : null,
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

export async function updateCategory(id: string, data: { name?: string; slug?: string; store?: "BIKE" | "MOTOR" | "BOTH"; order?: number; isActive?: boolean; parentId?: string | null; imageUrl?: string; menuImageUrl?: string; isFeatured?: boolean; isInHeader?: boolean; headerOrder?: number; trendyolCategoryId?: number | null; n11CategoryId?: number | null; hbCategoryId?: string | null; idefixCategoryId?: string | number | null; pazaramaCategoryId?: string | number | null; ciceksepetiCategoryId?: string | number | null; googleProductCategory?: string | null; description?: string | null }) {
    try {
        const updateData: Record<string, any> = {};
        
        // Sadece tanımlı alanları ekle (undefined olanları Prisma'ya gönderme)
        if (data.name !== undefined) updateData.name = data.name;
        if (data.slug !== undefined) updateData.slug = data.slug;
        if (data.store !== undefined) updateData.store = data.store;
        if (data.order !== undefined) updateData.order = data.order;
        if (data.isActive !== undefined) updateData.isActive = data.isActive;
        if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
        if (data.menuImageUrl !== undefined) updateData.menuImageUrl = data.menuImageUrl;
        if (data.isFeatured !== undefined) updateData.isFeatured = data.isFeatured;
        if (data.isInHeader !== undefined) updateData.isInHeader = data.isInHeader;
        if (data.headerOrder !== undefined) updateData.headerOrder = data.headerOrder;
        if (data.trendyolCategoryId !== undefined) updateData.trendyolCategoryId = data.trendyolCategoryId;
        if (data.n11CategoryId !== undefined) updateData.n11CategoryId = data.n11CategoryId;
        if (data.googleProductCategory !== undefined) updateData.googleProductCategory = data.googleProductCategory;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.parentId !== undefined) updateData.parentId = data.parentId || null;
        
        // String marketplace ID'leri - özellikle dönüştür
        if (data.hbCategoryId !== undefined) updateData.hbCategoryId = data.hbCategoryId ? String(data.hbCategoryId).trim() : null;
        if (data.idefixCategoryId !== undefined) updateData.idefixCategoryId = data.idefixCategoryId ? String(data.idefixCategoryId).trim() : null;
        if (data.pazaramaCategoryId !== undefined) updateData.pazaramaCategoryId = data.pazaramaCategoryId ? String(data.pazaramaCategoryId).trim() : null;
        if (data.ciceksepetiCategoryId !== undefined) updateData.ciceksepetiCategoryId = data.ciceksepetiCategoryId ? String(data.ciceksepetiCategoryId).trim() : null;

        console.log("[updateCategory] ID:", id, "ciceksepetiCategoryId input:", data.ciceksepetiCategoryId, "-> saved:", updateData.ciceksepetiCategoryId);

        await prisma.category.update({
            where: { id },
            data: updateData,
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

export async function mergeTireCategoriesAction() {
    try {
        const mainParent = await prisma.category.findFirst({
            where: { slug: { in: ["motosiklet-yedek-parca-1", "motosiklet-yedek-parca"] } }
        });
        const parentId = mainParent?.id || null;

        // 1. Target Motosiklet Dış Lastikler
        let targetDis = await prisma.category.findFirst({
            where: { OR: [{ slug: "motosiklet-dis-lastikler" }, { name: "Motosiklet Dış Lastikler" }] }
        });
        if (!targetDis) {
            targetDis = await prisma.category.create({
                data: {
                    name: "Motosiklet Dış Lastikler",
                    slug: "motosiklet-dis-lastikler",
                    store: "MOTOR",
                    parentId,
                    isActive: true,
                }
            });
        }

        // 2. Target Motosiklet İç Lastikler
        let targetIc = await prisma.category.findFirst({
            where: { OR: [{ slug: "motosiklet-i-c-lastikler" }, { slug: "motosiklet-ic-lastikler" }, { name: "Motosiklet İç Lastikler" }] }
        });
        if (!targetIc) {
            targetIc = await prisma.category.create({
                data: {
                    name: "Motosiklet İç Lastikler",
                    slug: "motosiklet-i-c-lastikler",
                    store: "MOTOR",
                    parentId,
                    isActive: true,
                }
            });
        }

        // 3. Move Dış Lastik products (from "lastik" and "lastik-1")
        const sourceDisCats = await prisma.category.findMany({
            where: { slug: { in: ["lastik", "lastik-1"] } }
        });
        const sourceDisIds = sourceDisCats.map(c => c.id).filter(id => id !== targetDis!.id);

        if (sourceDisIds.length > 0) {
            await prisma.product.updateMany({
                where: { categoryId: { in: sourceDisIds } },
                data: { categoryId: targetDis.id }
            });

            for (const sId of sourceDisIds) {
                await prisma.$executeRawUnsafe(
                    `UPDATE "_CategoryToProduct" SET "A" = $1 WHERE "A" = $2 AND "B" NOT IN (SELECT "B" FROM "_CategoryToProduct" WHERE "A" = $1)`,
                    targetDis.id, sId
                );
                await prisma.$executeRawUnsafe(`DELETE FROM "_CategoryToProduct" WHERE "A" = $1`, sId);
            }
        }

        // 4. Move İç Lastik products (from "ic-lastik")
        const sourceIcCats = await prisma.category.findMany({
            where: { slug: { in: ["ic-lastik"] } }
        });
        const sourceIcIds = sourceIcCats.map(c => c.id).filter(id => id !== targetIc!.id);

        if (sourceIcIds.length > 0) {
            await prisma.product.updateMany({
                where: { categoryId: { in: sourceIcIds } },
                data: { categoryId: targetIc.id }
            });

            for (const sId of sourceIcIds) {
                await prisma.$executeRawUnsafe(
                    `UPDATE "_CategoryToProduct" SET "A" = $1 WHERE "A" = $2 AND "B" NOT IN (SELECT "B" FROM "_CategoryToProduct" WHERE "A" = $1)`,
                    targetIc.id, sId
                );
                await prisma.$executeRawUnsafe(`DELETE FROM "_CategoryToProduct" WHERE "A" = $1`, sId);
            }
        }

        // 5. Delete empty duplicates
        const allDeleteIds = [...sourceDisIds, ...sourceIcIds];
        if (allDeleteIds.length > 0) {
            await prisma.category.deleteMany({
                where: { id: { in: allDeleteIds } }
            });
        }

        revalidatePath("/admin/categories");
        revalidatePath("/admin/products");
        revalidatePath("/");

        return {
            success: true,
            message: `Lastik kategorileri birleştirildi. "Motosiklet Dış Lastikler" ve "Motosiklet İç Lastikler" altında toplandı.`
        };
    } catch (err: any) {
        return { success: false, message: err.message };
    }
}

export async function getCategoryProductsAction(categoryId: string) {
    try {
        const products = await prisma.product.findMany({
            where: {
                OR: [
                    { categoryId },
                    { categories: { some: { id: categoryId } } }
                ]
            },
            select: {
                id: true,
                name: true,
                sku: true,
                barcode: true,
                stock: true,
                listPrice: true,
                images: true,
                categoryId: true,
                categories: {
                    select: { id: true, name: true }
                }
            },
            orderBy: { name: "asc" },
            take: 100
        });

        return {
            success: true,
            products: products.map(p => ({
                ...p,
                listPrice: p.listPrice.toNumber(),
            }))
        };
    } catch (err: any) {
        return { success: false, error: err.message, products: [] };
    }
}

export async function moveProductToCategoryAction(productId: string, targetCategoryId: string) {
    try {
        await prisma.product.update({
            where: { id: productId },
            data: {
                categoryId: targetCategoryId,
                categories: {
                    set: [{ id: targetCategoryId }]
                }
            }
        });

        revalidatePath("/admin/categories");
        revalidatePath("/admin/products");
        revalidatePath("/");
        return { success: true, message: "Ürün yeni kategoriye taşındı." };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function moveAllProductsAndMergeCategoryAction(sourceCategoryId: string, targetCategoryId: string, deleteSource: boolean = false) {
    try {
        const updateLegacy = await prisma.product.updateMany({
            where: { categoryId: sourceCategoryId },
            data: { categoryId: targetCategoryId }
        });

        await prisma.$executeRawUnsafe(
            `UPDATE "_CategoryToProduct" SET "A" = $1 WHERE "A" = $2 AND "B" NOT IN (SELECT "B" FROM "_CategoryToProduct" WHERE "A" = $1)`,
            targetCategoryId,
            sourceCategoryId
        );
        await prisma.$executeRawUnsafe(
            `DELETE FROM "_CategoryToProduct" WHERE "A" = $1`,
            sourceCategoryId
        );

        if (deleteSource) {
            await prisma.category.delete({
                where: { id: sourceCategoryId }
            });
        }

        revalidatePath("/admin/categories");
        revalidatePath("/admin/products");
        revalidatePath("/");

        return {
            success: true,
            message: deleteSource
                ? "Tüm ürünler aktarıldı ve eski kategori silindi."
                : "Tüm ürünler başarıyla yeni kategoriye aktarıldı."
        };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}
