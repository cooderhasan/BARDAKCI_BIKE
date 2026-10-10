"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getStoreType } from "@/lib/store-helper";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_PENDING_PER_EMAIL = 20;

/** Stokta olmayan ürün için "Gelince Haber Ver" talebi kaydeder (üye olan/olmayan herkes). */
export async function requestStockNotification(input: {
    productId: string;
    variantId?: string | null;
    email?: string;
    consent: boolean;
}): Promise<{ success: boolean; message: string }> {
    try {
        if (!input.consent) return { success: false, message: "Devam etmek için bilgilendirme onayını işaretleyin." };

        const session = await auth().catch(() => null);
        const email = String(input.email || session?.user?.email || "").trim().toLowerCase();
        if (!EMAIL_RE.test(email) || email.length > 200) return { success: false, message: "Geçerli bir e-posta adresi girin." };

        const product = await prisma.product.findUnique({
            where: { id: input.productId },
            select: { id: true, isActive: true, stock: true, variants: { select: { id: true, stock: true } } },
        });
        if (!product || !product.isActive) return { success: false, message: "Ürün bulunamadı." };

        const variant = input.variantId ? product.variants.find((v) => v.id === input.variantId) : null;
        if (input.variantId && !variant) return { success: false, message: "Seçilen seçenek bulunamadı." };
        const inStock = variant ? variant.stock > 0 : product.stock > 0;
        if (inStock) return { success: false, message: "Bu ürün şu an stokta, hemen sipariş verebilirsiniz." };

        const variantId = variant?.id ?? null;
        const existing = await prisma.stockNotification.findFirst({
            where: { productId: product.id, variantId, email, notifiedAt: null },
            select: { id: true },
        });
        if (existing) return { success: true, message: "Talebiniz zaten kayıtlı. Ürün stoğa girdiğinde e-posta ile haber vereceğiz." };

        // Kötüye kullanımı sınırla
        const pendingCount = await prisma.stockNotification.count({ where: { email, notifiedAt: null } });
        if (pendingCount >= MAX_PENDING_PER_EMAIL) {
            return { success: false, message: "Bu e-posta adresiyle çok fazla bekleyen talep var." };
        }

        await prisma.stockNotification.create({
            data: {
                productId: product.id,
                variantId,
                email,
                userId: session?.user?.id || null,
                store: await getStoreType(),
            },
        });
        return { success: true, message: "Talebiniz alındı. Ürün stoğa girdiğinde e-posta ile haber vereceğiz." };
    } catch (error) {
        console.error("requestStockNotification error:", error);
        return { success: false, message: "Talebiniz kaydedilemedi, lütfen tekrar deneyin." };
    }
}
