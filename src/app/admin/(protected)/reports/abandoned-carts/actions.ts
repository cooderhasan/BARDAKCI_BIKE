"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { sendAbandonedCartEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";

export async function getAbandonedCartsAction() {
    try {
        const session = await auth();
        if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
            return { success: false, error: "Yetkisiz erişim." };
        }

        // 2 saatten eski olan sepetleri getirelim
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

        // Not: Cart.updatedAt sepete ürün eklenince değişmiyor (ürünler ayrı tabloda); son işlem ürünlerden hesaplanır
        const rawCarts = await prisma.cart.findMany({
            where: {
                items: {
                    some: {} // Sepetinde en az 1 ürün olanlar
                },
            },
            select: {
                id: true,
                updatedAt: true,
                reminderSentAt: true,
                reminderCount: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        companyName: true,
                        phone: true,
                        // Sepetten sonra sipariş verdiyse sepet terk edilmiş sayılmaz (ödemesi tamamlanmamış/iptal hariç)
                        orders: {
                            where: { status: { notIn: ["WAITING_FOR_PAYMENT", "CANCELLED"] } },
                            orderBy: { createdAt: "desc" },
                            take: 1,
                            select: { createdAt: true },
                        },
                    }
                },
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                listPrice: true,
                                salePrice: true,
                                images: true
                            }
                        },
                        variant: true
                    }
                }
            },
        });

        const carts = rawCarts
            .map((cart: any) => {
                const lastActivity = new Date(Math.max(...cart.items.map((i: any) => Math.max(new Date(i.updatedAt).getTime(), new Date(i.createdAt).getTime()))));
                const lastOrderAt = cart.user?.orders?.[0]?.createdAt ? new Date(cart.user.orders[0].createdAt) : null;
                return { ...cart, updatedAt: lastActivity, lastOrderAt };
            })
            // Son sepet değişikliğinden sonra sipariş verenler listeden çıkar (sipariş sonrası sepeti temizlenmemiş olabilir)
            .filter((cart: any) => cart.updatedAt <= twoHoursAgo && !(cart.lastOrderAt && cart.lastOrderAt >= cart.updatedAt))
            .map(({ lastOrderAt, user, ...cart }: any) => ({ ...cart, user: user ? { id: user.id, email: user.email, companyName: user.companyName, phone: user.phone } : user }))
            .sort((a: any, b: any) => b.updatedAt.getTime() - a.updatedAt.getTime());

        return { success: true, carts };
    } catch (error) {
        console.error("Sepetleri getirirken hata oluştu:", error);
        return { success: false, error: "Veriler yüklenemedi." };
    }
}

export async function sendCartReminderAction(cartId: string) {
    try {
        const session = await auth();
        if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
            return { success: false, error: "Yetkisiz erişim." };
        }

        const cart = await prisma.cart.findUnique({
            where: { id: cartId },
            include: {
                user: {
                    select: {
                        email: true,
                        companyName: true
                    }
                },
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                listPrice: true,
                                salePrice: true,
                                images: true
                            }
                        },
                        variant: true
                    }
                }
            }
        });

        if (!cart || !cart.user || cart.items.length === 0) {
            return { success: false, error: "Geçerli bir sepet bulunamadı veya e-posta adresi eksik." };
        }

        // Son 24 saat içinde zaten hatırlatma gönderildi mi kontrol et
        if (cart.reminderSentAt) {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            if (new Date(cart.reminderSentAt) > twentyFourHoursAgo) {
                return { success: false, error: "Bu müşteriye son 24 saat içinde zaten hatırlatma gönderildi." };
            }
        }

        const domain = process.env.NEXT_PUBLIC_APP_URL || "https://www.bardakcibike.com.tr";
        let totalAmount = 0;

        const emailItems = cart.items.map((item: any) => {
            const price = Number(item.product.salePrice || item.product.listPrice);
            const lineTotal = price * item.quantity;
            totalAmount += lineTotal;

            const imageUrl = item.product.images[0];
            const fullImageUrl = imageUrl ? (imageUrl.startsWith('http') ? imageUrl : `${domain}${imageUrl}`) : undefined;

            return {
                productName: item.product.name + (item.variant ? ` (${item.variant.size} - ${item.variant.color})` : ""),
                quantity: item.quantity,
                unitPrice: price,
                lineTotal: lineTotal,
                imageUrl: fullImageUrl,
            };
        });

        const customerName = cart.user.companyName || cart.user.email || "Değerli Müşterimiz";
        const continueShoppingUrl = `${domain}/cart`;

        const result = await sendAbandonedCartEmail({
            to: cart.user.email,
            customerName: customerName,
            items: emailItems,
            totalAmount: totalAmount,
            continueShoppingUrl: continueShoppingUrl
        });

        if (!result.success) {
            return { success: false, error: "E-postayı gönderirken bir hata oluştu." };
        }

        // Başarılı gönderim sonrası Cart kaydını güncelle
        await prisma.cart.update({
            where: { id: cartId },
            data: {
                reminderSentAt: new Date(),
                reminderCount: { increment: 1 },
            },
        });

        return { success: true, message: "Hatırlatma maili başarıyla gönderildi." };
    } catch (error) {
        console.error("Hatırlatma e-postası hatası:", error);
        return { success: false, error: "Beklenmeyen bir hata oluştu." };
    }
}
