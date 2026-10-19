"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export interface AddressInput {
    id?: string;
    title: string;
    name: string;
    phone: string;
    city: string;
    district: string;
    address: string;
    isDefault?: boolean;
}

export interface SavedAddress extends Required<Omit<AddressInput, "id" | "isDefault">> {
    id: string;
    isDefault: boolean;
}

const MAX_ADDRESSES = 10;

/** Varsayılan adres, eski tek-adres alanlarıyla (User.address/city/district/phone) eşit tutulur; başka yerler onları okuyor */
async function syncUserDefault(userId: string, a: { phone: string; city: string; district: string; address: string }) {
    await prisma.user.update({
        where: { id: userId },
        data: { phone: a.phone, city: a.city, district: a.district, address: a.address },
    });
}

/**
 * Üyenin adresleri (varsayılan önce). Adres defteri yokken kayıtlı tek adresi olan üyede bu adres
 * ilk açılışta "Adresim" adıyla varsayılan adres olarak deftere aktarılır; kimse adres kaybetmez.
 */
export async function getMyAddresses(): Promise<SavedAddress[]> {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return [];

    let list = await prisma.userAddress.findMany({
        where: { userId },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

    if (list.length === 0) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, companyName: true, phone: true, city: true, district: true, address: true },
        });
        if (user?.address && user.address.trim()) {
            const created = await prisma.userAddress.create({
                data: {
                    userId,
                    title: "Adresim",
                    name: user.companyName || user.name || "",
                    phone: user.phone || "",
                    city: user.city || "",
                    district: user.district || "",
                    address: user.address,
                    isDefault: true,
                },
            });
            list = [created];
        }
    }

    return list.map((a) => ({
        id: a.id,
        title: a.title,
        name: a.name,
        phone: a.phone,
        city: a.city,
        district: a.district,
        address: a.address,
        isDefault: a.isDefault,
    }));
}

export async function saveAddress(input: AddressInput): Promise<{ success: boolean; error?: string; id?: string }> {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { success: false, error: "Oturum bulunamadı. Lütfen giriş yapın." };

    const data = {
        title: (input.title || "").trim() || "Adresim",
        name: (input.name || "").trim(),
        phone: (input.phone || "").trim(),
        city: (input.city || "").trim(),
        district: (input.district || "").trim(),
        address: (input.address || "").trim(),
    };
    if (!data.name || !data.phone || !data.city || !data.district || !data.address) {
        return { success: false, error: "Lütfen tüm alanları doldurun." };
    }
    if (data.phone.replace(/\D/g, "").length < 10) {
        return { success: false, error: "Lütfen geçerli bir telefon numarası girin." };
    }

    try {
        const count = await prisma.userAddress.count({ where: { userId } });
        let id = input.id;

        if (id) {
            const existing = await prisma.userAddress.findFirst({ where: { id, userId } });
            if (!existing) return { success: false, error: "Adres bulunamadı." };
            const makeDefault = !!input.isDefault || existing.isDefault;
            await prisma.$transaction(async (tx) => {
                if (makeDefault && !existing.isDefault) {
                    await tx.userAddress.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
                }
                await tx.userAddress.update({ where: { id: existing.id }, data: { ...data, isDefault: makeDefault } });
            });
            if (makeDefault) await syncUserDefault(userId, data);
        } else {
            if (count >= MAX_ADDRESSES) return { success: false, error: `En fazla ${MAX_ADDRESSES} adres kaydedebilirsiniz.` };
            // İlk adres her zaman varsayılan
            const makeDefault = count === 0 || !!input.isDefault;
            const created = await prisma.$transaction(async (tx) => {
                if (makeDefault) {
                    await tx.userAddress.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
                }
                return tx.userAddress.create({ data: { ...data, userId, isDefault: makeDefault } });
            });
            id = created.id;
            if (makeDefault) await syncUserDefault(userId, data);
        }

        revalidatePath("/account/addresses");
        return { success: true, id };
    } catch (e) {
        console.error("saveAddress error:", e);
        return { success: false, error: "Adres kaydedilemedi." };
    }
}

export async function setDefaultAddress(id: string): Promise<{ success: boolean; error?: string }> {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { success: false, error: "Oturum bulunamadı." };

    const target = await prisma.userAddress.findFirst({ where: { id, userId } });
    if (!target) return { success: false, error: "Adres bulunamadı." };

    await prisma.$transaction([
        prisma.userAddress.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } }),
        prisma.userAddress.update({ where: { id }, data: { isDefault: true } }),
    ]);
    await syncUserDefault(userId, target);
    revalidatePath("/account/addresses");
    return { success: true };
}

export async function deleteAddress(id: string): Promise<{ success: boolean; error?: string }> {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { success: false, error: "Oturum bulunamadı." };

    const target = await prisma.userAddress.findFirst({ where: { id, userId } });
    if (!target) return { success: false, error: "Adres bulunamadı." };

    const count = await prisma.userAddress.count({ where: { userId } });
    // Son adres silinmez (eski tek-adres alanlarından yeniden oluşmasın; düzenlenebilir)
    if (count <= 1) return { success: false, error: "Son adresinizi silemezsiniz; düzenleyebilirsiniz." };

    await prisma.userAddress.delete({ where: { id } });

    if (target.isDefault) {
        const next = await prisma.userAddress.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
        if (next) {
            await prisma.userAddress.update({ where: { id: next.id }, data: { isDefault: true } });
            await syncUserDefault(userId, next);
        }
    }
    revalidatePath("/account/addresses");
    return { success: true };
}
