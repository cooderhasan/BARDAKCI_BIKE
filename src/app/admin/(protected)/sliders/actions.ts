"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getSliders() {
    return prisma.slider.findMany({
        orderBy: { order: "asc" },
    });
}

export async function createSlider(data: {
    title?: string;
    subtitle?: string;
    imageUrl: string;
    linkUrl?: string;
    store?: "BIKE" | "MOTOR" | "BOTH";
    order: number;
    isActive: boolean;
    showOverlay?: boolean;
}) {
    try {
        await prisma.slider.create({
            data,
        });
        revalidatePath("/");
        revalidatePath("/admin/sliders");
        return { success: true };
    } catch (error) {
        console.error("Create slider error:", error);
        return { success: false, error: "Slider oluşturulamadı." };
    }
}

export async function updateSlider(
    id: string,
    data: {
        title?: string;
        subtitle?: string;
        imageUrl?: string;
        linkUrl?: string;
        store?: "BIKE" | "MOTOR" | "BOTH";
        order?: number;
        isActive?: boolean;
        showOverlay?: boolean;
    }
) {
    try {
        await prisma.slider.update({
            where: { id },
            data,
        });
        revalidatePath("/");
        revalidatePath("/admin/sliders");
        return { success: true };
    } catch (error) {
        console.error("Update slider error:", error);
        return { success: false, error: "Slider güncellenemedi." };
    }
}


export async function deleteSlider(id: string) {
    try {
        await prisma.slider.delete({
            where: { id },
        });
        revalidatePath("/");
        revalidatePath("/admin/sliders");
        return { success: true };
    } catch (error) {
        console.error("Delete slider error:", error);
        return { success: false, error: "Slider silinemedi." };
    }
}

export async function toggleSliderStatus(id: string, isActive: boolean) {
    try {
        await prisma.slider.update({
            where: { id },
            data: { isActive },
        });
        revalidatePath("/");
        revalidatePath("/admin/sliders");
        return { success: true };
    } catch (error) {
        console.error("Toggle slider status error:", error);
        return { success: false, error: "Slider durumu güncellenemedi." };
    }
}
