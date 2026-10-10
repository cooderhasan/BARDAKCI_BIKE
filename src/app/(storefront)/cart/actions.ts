"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { CartItem as StoreCartItem } from "@/types";

export async function syncCart(items: StoreCartItem[]) {
    console.log("SYNC_CART: Received request, item count:", items.length);
    try {
        const session = await auth();
        if (!session?.user?.id) {
            console.log("SYNC_CART: No active session, skipping sync.");
            return { success: false, error: "Unauthorized" };
        }

        const userId = session.user.id;
        console.log("SYNC_CART: Syncing for user:", userId);

        // Ensure cart exists
        let cart = await prisma.cart.findUnique({
            where: { userId },
        });

        if (!cart) {
            cart = await prisma.cart.create({
                data: { userId },
            });
        }

        // Sadece değişen ürünler güncellenir. Önceden her senkronda tüm ürünler silinip yeniden oluşturuluyordu;
        // siteye girmek bile sepetin "son işlem" zamanını sıfırlıyor, Sepette Bekleyenler raporu yanılıyordu.
        const keyOf = (productId: string, variantId?: string | null) => `${productId}|${variantId || ""}`;
        const existing = await prisma.cartItem.findMany({ where: { cartId: cart.id } });
        const existingByKey = new Map(existing.map((e) => [keyOf(e.productId, e.variantId), e]));
        const incomingByKey = new Map<string, StoreCartItem>();
        for (const item of items) incomingByKey.set(keyOf(item.productId, item.variantId), item);

        const ops: any[] = [];
        const removedIds = existing.filter((e) => !incomingByKey.has(keyOf(e.productId, e.variantId))).map((e) => e.id);
        if (removedIds.length) ops.push(prisma.cartItem.deleteMany({ where: { id: { in: removedIds } } }));
        for (const [key, item] of incomingByKey) {
            const ex = existingByKey.get(key);
            if (!ex) {
                ops.push(prisma.cartItem.create({
                    data: { cartId: cart!.id, productId: item.productId, variantId: item.variantId || null, quantity: item.quantity },
                }));
            } else if (ex.quantity !== item.quantity) {
                ops.push(prisma.cartItem.update({ where: { id: ex.id }, data: { quantity: item.quantity } }));
            }
        }
        if (ops.length) await prisma.$transaction(ops);

        console.log("SYNC_CART: Sync successful.");
        return { success: true };
    } catch (error) {
        console.error("SYNC_CART: Cart sync error:", error);
        return { success: false, error: "Sepet senkronize edilemedi." };
    }
}

export async function getDBCart(providedUserId?: string, userDiscountRate?: number) {
    try {
        let userId = providedUserId;

        if (!userId) {
            const session = await auth();
            userId = session?.user?.id;
        }

        if (!userId) return null;

        // If userDiscountRate is not provided, try to fetch it
        if (userDiscountRate === undefined) {
            try {
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    select: {
                        discountGroup: {
                            select: { discountRate: true }
                        }
                    }
                });
                userDiscountRate = Number(user?.discountGroup?.discountRate || 0);
            } catch (error) {
                console.warn("Could not fetch user discount rate in getDBCart, defaulting to 0.", error);
                userDiscountRate = 0;
            }
        }

        const cart = await prisma.cart.findUnique({
            where: { userId: userId },
            include: {
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                                listPrice: true,
                                salePrice: true,
                                vatRate: true,
                                stock: true,
                                minQuantity: true,
                                images: true,
                                desi: true,
                                isBundle: true,
                                bundleItems: {
                                    select: {
                                        quantity: true,
                                        childProduct: {
                                            select: { stock: true },
                                        },
                                    },
                                },
                            }
                        },
                        variant: {
                            select: {
                                id: true,
                                color: true,
                                size: true,
                                priceAdjustment: true,
                                stock: true,
                            }
                        }
                    }
                }
            }
        });

        if (!cart) return [];

        return cart.items.map((item) => {
            const listPrice = Number(item.product.listPrice) + Number(item.variant?.priceAdjustment || 0);

            // Calculate stock: for bundles use dynamic calculation
            let stock = item.variant ? item.variant.stock : item.product.stock;
            if (item.product.isBundle && item.product.bundleItems.length > 0) {
                stock = Math.min(
                    ...item.product.bundleItems.map((bi: any) =>
                        Math.floor(bi.childProduct.stock / bi.quantity)
                    )
                );
                stock = Math.max(0, stock);
            }

            return {
                productId: item.productId,
                name: item.product.name,
                slug: item.product.slug,
                image: item.product.images[0] || "",
                quantity: item.quantity,
                listPrice: listPrice,
                salePrice: item.product.salePrice ? Number(item.product.salePrice) : undefined,
                discountRate: userDiscountRate ?? 0,
                vatRate: item.product.vatRate,
                minQuantity: item.product.minQuantity,
                stock: stock,
                variantId: item.variantId || undefined,
                variantInfo: item.variant ? `${item.variant.color || ""} ${item.variant.size || ""}`.trim() : undefined,
                desi: item.product.desi ? Number(item.product.desi) : null,
            };
        });
    } catch (error) {
        console.error("GET_DB_CART: Error:", error);
        return null;
    }
}

export async function clearDBCart() {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false };

        const cart = await prisma.cart.findUnique({
            where: { userId: session.user.id },
        });

        if (cart) {
            await prisma.cartItem.deleteMany({
                where: { cartId: cart.id },
            });
        }

        return { success: true };
    } catch (error) {
        console.error("Clear DB cart error:", error);
        return { success: false };
    }
}
