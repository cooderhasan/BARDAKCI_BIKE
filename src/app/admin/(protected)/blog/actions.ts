"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { generateSlug } from "@/lib/helpers";

export async function createBlogPost(data: {
    title: string;
    content: string;
    summary?: string;
    imageUrl?: string;
    relatedProductIds?: string[];
    isActive?: boolean;
    readTime?: number;
}) {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
        throw new Error("Unauthorized");
    }

    const baseSlug = generateSlug(data.title);
    let uniqueSlug = baseSlug;
    let slugCounter = 0;
    while (true) {
        const existing = await prisma.blogPost.findFirst({ where: { slug: uniqueSlug } });
        if (!existing) break;
        slugCounter++;
        uniqueSlug = `${baseSlug}-${slugCounter}`;
    }

    try {
        await prisma.blogPost.create({
            data: {
                title: data.title,
                slug: uniqueSlug,
                content: data.content,
                summary: data.summary || null,
                imageUrl: data.imageUrl || null,
                relatedProductIds: data.relatedProductIds || [],
                isActive: data.isActive ?? true,
                readTime: data.readTime ?? 5,
            },
        });

        revalidatePath("/admin/blog");
        revalidatePath("/blog");
        revalidatePath("/");
        return { success: true, message: "Blog yazısı oluşturuldu." };
    } catch (error: any) {
        console.error("createBlogPost error:", error);
        return { success: false, message: "Blog yazısı oluşturulamadı: " + error.message };
    }
}

export async function updateBlogPost(id: string, data: {
    title?: string;
    content?: string;
    summary?: string;
    imageUrl?: string;
    relatedProductIds?: string[];
    isActive?: boolean;
    readTime?: number;
}) {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
        throw new Error("Unauthorized");
    }

    try {
        await prisma.blogPost.update({
            where: { id },
            data: {
                ...data,
            },
        });

        const blog = await prisma.blogPost.findUnique({ where: { id } });

        revalidatePath("/admin/blog");
        revalidatePath("/blog");
        if (blog) {
            revalidatePath(`/blog/${blog.slug}`);
        }
        revalidatePath("/");
        return { success: true, message: "Blog yazısı güncellendi." };
    } catch (error: any) {
        console.error("updateBlogPost error:", error);
        return { success: false, message: "Blog yazısı güncellenemedi: " + error.message };
    }
}

export async function deleteBlogPost(id: string) {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
        throw new Error("Unauthorized");
    }

    try {
        const blog = await prisma.blogPost.findUnique({ where: { id } });
        await prisma.blogPost.delete({ where: { id } });

        revalidatePath("/admin/blog");
        revalidatePath("/blog");
        if (blog) {
            revalidatePath(`/blog/${blog.slug}`);
        }
        revalidatePath("/");
        return { success: true, message: "Blog yazısı silindi." };
    } catch (error: any) {
        console.error("deleteBlogPost error:", error);
        return { success: false, message: "Blog yazısı silinemedi: " + error.message };
    }
}

export async function toggleBlogPostStatus(id: string, isActive: boolean) {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
        throw new Error("Unauthorized");
    }

    try {
        const blog = await prisma.blogPost.update({
            where: { id },
            data: { isActive },
        });

        revalidatePath("/admin/blog");
        revalidatePath("/blog");
        revalidatePath(`/blog/${blog.slug}`);
        revalidatePath("/");
        return { success: true };
    } catch (error: any) {
        console.error("toggleBlogPostStatus error:", error);
        return { success: false };
    }
}

export async function searchProductsForBlog(query: string) {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
        throw new Error("Unauthorized");
    }

    if (!query || query.trim().length < 2) return [];

    const cleanQuery = query.trim();

    const products = await prisma.product.findMany({
        where: {
            isActive: true,
            OR: [
                { name: { contains: cleanQuery, mode: "insensitive" } },
                { sku: { contains: cleanQuery, mode: "insensitive" } },
                { barcode: { contains: cleanQuery, mode: "insensitive" } },
            ],
        },
        select: {
            id: true,
            name: true,
            sku: true,
            store: true,
            stock: true,
            listPrice: true,
            salePrice: true,
            images: true,
        },
        orderBy: [{ stock: "desc" }, { createdAt: "desc" }],
        take: 12,
    });

    return products.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        store: p.store,
        stock: p.stock,
        listPrice: Number(p.listPrice),
        salePrice: p.salePrice ? Number(p.salePrice) : null,
        image: p.images && p.images.length > 0 ? p.images[0] : null,
    }));
}

export async function getProductsByIds(ids: string[]) {
    if (!ids || ids.length === 0) return [];
    
    const products = await prisma.product.findMany({
        where: {
            id: { in: ids }
        },
        select: {
            id: true,
            name: true,
            sku: true,
            store: true,
            stock: true,
            listPrice: true,
            salePrice: true,
            images: true,
        }
    });

    return products.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        store: p.store,
        stock: p.stock,
        listPrice: Number(p.listPrice),
        salePrice: p.salePrice ? Number(p.salePrice) : null,
        image: p.images && p.images.length > 0 ? p.images[0] : null,
    }));
}
