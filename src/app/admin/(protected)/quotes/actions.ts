"use server";
import { requireAdmin } from "@/lib/admin-guard";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// Teklif fiyatlarını güncelle
export async function updateQuotePrices(
    quoteId: string,
    items: { itemId: string; quotedPrice: number }[],
    discount: number,
    validDays: number,
    adminNotes?: string
) {
    await requireAdmin();
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
        throw new Error("Unauthorized");
    }

    // Ürün fiyatlarını güncelle
    for (const item of items) {
        const lineTotal = await prisma.quoteItem.findUnique({
            where: { id: item.itemId },
            select: { quantity: true }
        });

        if (lineTotal) {
            await prisma.quoteItem.update({
                where: { id: item.itemId },
                data: {
                    quotedPrice: item.quotedPrice,
                    lineTotal: item.quotedPrice * lineTotal.quantity
                }
            });
        }
    }

    // Toplam hesapla
    const updatedItems = await prisma.quoteItem.findMany({
        where: { quoteId },
        select: { lineTotal: true }
    });

    const subtotal = updatedItems.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
    const total = subtotal - discount;

    // Geçerlilik süresi
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validDays);

    // Teklifi güncelle
    await prisma.quote.update({
        where: { id: quoteId },
        data: {
            status: "QUOTED",
            subtotal,
            discount,
            total,
            validUntil,
            adminNotes: adminNotes || null
        }
    });

    revalidatePath("/admin/quotes");
    revalidatePath(`/admin/quotes/${quoteId}`);

    return { success: true };
}

// Teklif durumunu güncelle
export async function updateQuoteStatus(
    quoteId: string,
    status: "PENDING" | "REVIEWING" | "QUOTED" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CONVERTED"
) {
    await requireAdmin();
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
        throw new Error("Unauthorized");
    }

    await prisma.quote.update({
        where: { id: quoteId },
        data: { status }
    });

    revalidatePath("/admin/quotes");
    revalidatePath(`/admin/quotes/${quoteId}`);

    return { success: true };
}

// Teklifi siparişe dönüştür
export async function convertQuoteToOrder(quoteId: string) {
    await requireAdmin();
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
        throw new Error("Unauthorized");
    }

    const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        include: {
            items: {
                include: {
                    product: { select: { vatRate: true } }
                }
            },
            user: true
        }
    });

    if (!quote) {
        throw new Error("Teklif bulunamadı");
    }

    if (quote.status !== "ACCEPTED") {
        throw new Error("Sadece kabul edilmiş teklifler siparişe dönüştürülebilir");
    }

    // Sipariş numarası oluştur
    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;

    // Sipariş oluştur
    const order = await prisma.order.create({
        data: {
            orderNumber,
            userId: quote.userId,
            status: "CONFIRMED",
            subtotal: quote.subtotal || 0,
            discountAmount: quote.discount || 0,
            appliedDiscountRate: 0,
            vatAmount: 0, // Hesaplanabilir
            total: quote.total || 0,
            items: {
                create: quote.items.map(item => {
                    const listPrice = Number(item.listPrice);
                    const unitPrice = Number(item.quotedPrice || item.listPrice);
                    const discountRate = listPrice > 0 ? ((listPrice - unitPrice) / listPrice) * 100 : 0;

                    return {
                        productId: item.productId,
                        productName: item.productName,
                        quantity: item.quantity,
                        unitPrice: item.quotedPrice || item.listPrice,
                        lineTotal: item.lineTotal || 0,
                        vatRate: item.product.vatRate,
                        discountRate: discountRate
                    };
                })
            }
        }
    });

    // Teklifi güncelle
    await prisma.quote.update({
        where: { id: quoteId },
        data: { status: "CONVERTED" }
    });

    revalidatePath("/admin/quotes");
    revalidatePath("/admin/orders");

    return { success: true, orderId: order.id };
}
