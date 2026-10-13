"use server";
import { requireAdmin } from "@/lib/admin-guard";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export async function createDiscountGroup(data: { name: string; discountRate: number }) {
    await requireAdmin();
    await prisma.discountGroup.create({
        data: {
            name: data.name,
            discountRate: data.discountRate,
        },
    });
    revalidatePath("/admin/discount-groups");
}

export async function updateDiscountGroup(id: string, data: { name?: string; discountRate?: number; isActive?: boolean }) {
    await requireAdmin();
    await prisma.discountGroup.update({
        where: { id },
        data,
    });
    revalidatePath("/admin/discount-groups");
}

export async function deleteDiscountGroup(id: string) {
    await requireAdmin();
    await prisma.discountGroup.delete({
        where: { id },
    });
    revalidatePath("/admin/discount-groups");
}
