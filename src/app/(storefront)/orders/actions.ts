"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function getCustomerOrders() {
    const session = await auth();
    if (!session?.user?.id) return [];

    const orders = await prisma.order.findMany({
        where: { userId: session.user.id },
        include: {
            items: true,
            payment: true,
        },
        orderBy: { createdAt: "desc" },
    });

    // Serialize Decimal types for client components
    return orders.map((order) => ({
        ...order,
        subtotal: Number(order.subtotal),
        discountAmount: Number(order.discountAmount),
        vatAmount: Number(order.vatAmount),
        total: Number(order.total),
        items: order.items.map((item) => ({
            ...item,
            unitPrice: Number(item.unitPrice),
            lineTotal: Number(item.lineTotal),
        })),
        payment: order.payment
            ? {
                ...order.payment,
                amount: Number(order.payment.amount),
            }
            : null,
    }));
}

export async function getReorderItems(orderId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    // Fetch original order items
    const order = await prisma.order.findUnique({
        where: { id: orderId, userId: session.user.id },
        include: { items: true },
    });

    if (!order) throw new Error("Order not found");

    // Fetch CURRENT product details for these items
    const productIds = order.items.map(item => item.productId);
    const currentProducts = await prisma.product.findMany({
        where: {
            id: { in: productIds },
            isActive: true, // Only active products
        },
        select: {
            id: true,
            name: true,
            slug: true,
            listPrice: true,
            salePrice: true, // Add salePrice
            stock: true,
            images: true,
            vatRate: true,
            minQuantity: true,
            weight: true,
            desi: true,
            isFreeShipping: true,
        }
    });

    // Map original quantity to current product details
    const reorderItems = order.items.map(orderItem => {
        const product = currentProducts.find(p => p.id === orderItem.productId);

        if (!product || product.stock < 1) return null;

        // Ensure we at least meet minQuantity, but assume order quantity was valid.
        // If stock is less than order quantity, we can clamp it or return available stock.
        const quantityToAdd = Math.min(orderItem.quantity, product.stock);

        return {
            productId: product.id,
            name: product.name,
            slug: product.slug,
            price: Number(product.listPrice),
            salePrice: product.salePrice ? Number(product.salePrice) : undefined, // Include salePrice
            image: product.images[0] || "",
            quantity: quantityToAdd,
            vatRate: product.vatRate,
            stock: product.stock, // passing stock for client validation if needed
            minQuantity: product.minQuantity,
            desi: Number(product.desi || product.weight || 0),
            isFreeShipping: product.isFreeShipping ?? false,
        };
    }).filter(item => item !== null);

    return reorderItems;
}
