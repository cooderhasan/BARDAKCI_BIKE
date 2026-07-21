"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getBanners() {
    return await prisma.banner.findMany({
        orderBy: { order: "asc" },
    });
}

export async function createBanner(data: {
    title?: string;
    linkUrl?: string;
    imageUrl: string;
    store?: "BIKE" | "MOTOR" | "BOTH";
    isActive: boolean;
    order: number;
}) {
    try {
        await prisma.banner.create({
            data,
        });
        revalidatePath("/");
        revalidatePath("/admin/banners");
        return { success: true };
    } catch (error) {
        console.error("Banner create error:", error);
        return { success: false, error: "Banner oluşturulurken bir hata oluştu." };
    }
}

export async function updateBanner(id: string, data: {
    title?: string;
    linkUrl?: string;
    imageUrl?: string;
    store?: "BIKE" | "MOTOR" | "BOTH";
    isActive?: boolean;
    order?: number;
}) {
    try {
        await prisma.banner.update({
            where: { id },
            data,
        });
        revalidatePath("/");
        revalidatePath("/admin/banners");
        return { success: true };
    } catch (error) {
        console.error("Banner update error:", error);
        return { success: false, error: "Banner güncellenirken bir hata oluştu." };
    }
}

export async function deleteBanner(id: string) {
    try {
        await prisma.banner.delete({
            where: { id },
        });
        revalidatePath("/");
        revalidatePath("/admin/banners");
        return { success: true };
    } catch (error) {
        console.error("Banner delete error:", error);
        return { success: false, error: "Banner silinirken bir hata oluştu." };
    }
}
