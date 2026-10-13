"use server";
import { requireAdmin } from "@/lib/admin-guard";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const cargoSchema = z.object({
    name: z.string().min(1, "Kargo firma adı zorunludur"),
    isActive: z.boolean().optional(),
    isDesiActive: z.boolean().optional(),
});

export async function createCargoCompany(formData: FormData) {
    await requireAdmin();
    const session = await auth();
    if (session?.user.role !== "ADMIN" && session?.user.role !== "OPERATOR") {
        return { success: false, error: "Yetkisiz işlem." };
    }

    const name = formData.get("name") as string;
    const isActive = formData.get("isActive") === "on";
    const isDesiActive = formData.get("isDesiActive") === "on";

    const validated = cargoSchema.safeParse({ name, isActive, isDesiActive });

    if (!validated.success) {
        return { success: false, error: validated.error.issues[0].message };
    }

    try {
        // Prisma Client mismatch hatasını atlamak için raw query kullanıyoruz
        await prisma.$executeRaw`
            INSERT INTO "cargo_companies" ("id", "name", "isActive", "isDesiActive", "updatedAt")
            VALUES (${Math.random().toString(36).substring(2, 15)}, ${validated.data.name}, ${validated.data.isActive ?? true}, ${validated.data.isDesiActive ?? false}, NOW())
        `;

        revalidatePath("/admin/settings");
        return { success: true };
    } catch (error) {
        console.error("Create cargo error:", error);
        return { success: false, error: "Kargo firması oluşturulurken hata oluştu." };
    }
}

export async function toggleCargoCompany(id: string, currentState: boolean) {
    await requireAdmin();
    const session = await auth();
    if (session?.user.role !== "ADMIN" && session?.user.role !== "OPERATOR") {
        return { success: false, error: "Yetkisiz işlem." };
    }

    try {
        await prisma.cargoCompany.update({
            where: { id },
            data: { isActive: !currentState },
        });

        revalidatePath("/admin/settings");
        return { success: true };
    } catch (error) {
        console.error("Toggle cargo error:", error);
        return { success: false, error: "Kargo durumu güncellenirken hata oluştu." };
    }
}

export async function deleteCargoCompany(id: string) {
    await requireAdmin();
    const session = await auth();
    if (session?.user.role !== "ADMIN") {
        return { success: false, error: "Sadece yöneticiler silebilir." };
    }

    try {
        await prisma.cargoCompany.delete({
            where: { id },
        });

        revalidatePath("/admin/settings");
        return { success: true };
    } catch (error) {
        console.error("Delete cargo error:", error);
        return { success: false, error: "Silinirken hata oluştu." };
    }
}

export async function toggleDesiActive(id: string, currentState: boolean) {
    await requireAdmin();
    const session = await auth();
    if (session?.user.role !== "ADMIN" && session?.user.role !== "OPERATOR") {
        return { success: false, error: "Yetkisiz işlem." };
    }

    try {
        // Prisma Client mismatch hatasını atlamak için raw query kullanıyoruz
        await prisma.$executeRaw`UPDATE "cargo_companies" SET "isDesiActive" = ${!currentState} WHERE "id" = ${id}`;

        revalidatePath("/admin/settings");
        return { success: true };
    } catch (error) {
        console.error("Toggle desi active error:", error);
        return { success: false, error: "Desi durumu güncellenirken hata oluştu." };
    }
}

// ==================== DESİ FİYAT ARALIĞI İŞLEMLERİ ====================

interface DesiPriceRangeInput {
    id?: string;
    minDesi: number;
    maxDesi: number;
    price: number;
    multiplierType: string;
}

export async function saveDesiPriceRanges(cargoCompanyId: string, ranges: DesiPriceRangeInput[]) {
    await requireAdmin();
    const session = await auth();
    if (session?.user.role !== "ADMIN" && session?.user.role !== "OPERATOR") {
        return { success: false, error: "Yetkisiz işlem." };
    }

    try {
        // Mevcut aralıkları sil
        await prisma.$executeRaw`DELETE FROM "desi_price_ranges" WHERE "cargoCompanyId" = ${cargoCompanyId}`;

        if (ranges.length > 0) {
            // Bulk insert via multiple raw queries or one big one
            for (const r of ranges) {
                await prisma.$executeRaw`
                    INSERT INTO "desi_price_ranges" ("id", "cargoCompanyId", "minDesi", "maxDesi", "price", "multiplierType")
                    VALUES (${Math.random().toString(36).substring(2, 11)}, ${cargoCompanyId}, ${r.minDesi}, ${r.maxDesi}, ${r.price}, ${r.multiplierType || "FIXED"})
                `;
            }
        }

        revalidatePath("/admin/settings");
        return { success: true };
    } catch (error) {
        console.error("Save desi price ranges error:", error);
        return { success: false, error: "Desi fiyatları kaydedilirken hata oluştu." };
    }
}

export async function getDesiPriceRanges(cargoCompanyId: string) {
    await requireAdmin();
    // Raw query ile verileri çekiyoruz
    const ranges = await prisma.$queryRaw<any[]>`SELECT * FROM "desi_price_ranges" WHERE "cargoCompanyId" = ${cargoCompanyId} ORDER BY "minDesi" ASC`;

    return ranges.map((r) => ({
        id: r.id,
        minDesi: Number(r.minDesi),
        maxDesi: Number(r.maxDesi),
        price: Number(r.price),
        multiplierType: r.multiplierType,
    }));
}
