"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getFAQ(id: string) {
    try {
        return await prisma.fAQ.findUnique({
            where: { id },
        });
    } catch (error) {
        console.error("Get FAQ error:", error);
        return null;
    }
}

export async function getAllFAQs(onlyActive: boolean = false) {
    try {
        return await prisma.fAQ.findMany({
            where: onlyActive ? { isActive: true } : {},
            orderBy: [
                { category: "asc" },
                { order: "asc" }
            ],
        });
    } catch (error) {
        console.warn("Could not fetch FAQs, returning empty array.", error);
        return [];
    }
}

export async function createFAQ(data: {
    question: string;
    answer: string;
    category: string;
    order: number;
    isActive: boolean;
}) {
    try {
        await prisma.fAQ.create({
            data,
        });
        revalidatePath("/sss");
        revalidatePath("/admin/faqs");
        return { success: true };
    } catch (error) {
        console.error("Create FAQ error:", error);
        return { success: false, error: "Soru oluşturulamadı." };
    }
}

export async function updateFAQ(
    id: string,
    data: {
        question: string;
        answer: string;
        category: string;
        order: number;
        isActive: boolean;
    }
) {
    try {
        await prisma.fAQ.update({
            where: { id },
            data,
        });
        revalidatePath("/sss");
        revalidatePath("/admin/faqs");
        return { success: true };
    } catch (error) {
        console.error("Update FAQ error:", error);
        return { success: false, error: "Soru güncellenemedi." };
    }
}

export async function deleteFAQ(id: string) {
    try {
        await prisma.fAQ.delete({
            where: { id },
        });
        revalidatePath("/sss");
        revalidatePath("/admin/faqs");
        return { success: true };
    } catch (error) {
        console.error("Delete FAQ error:", error);
        return { success: false, error: "Soru silinemedi." };
    }
}

export async function toggleFAQStatus(id: string, isActive: boolean) {
    try {
        await prisma.fAQ.update({
            where: { id },
            data: { isActive },
        });
        revalidatePath("/sss");
        revalidatePath("/admin/faqs");
        return { success: true };
    } catch (error) {
        console.error("Toggle FAQ status error:", error);
        return { success: false, error: "Soru durumu güncellenemedi." };
    }
}
