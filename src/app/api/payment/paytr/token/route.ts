import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPayTRToken } from "@/lib/paytr";

export async function POST(req: NextRequest) {
    try {
        const { orderId } = await req.json();

        if (!orderId) {
            return NextResponse.json({ error: "Sipariş ID gerekli" }, { status: 400 });
        }

        const session = await auth();

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: true,
            },
        });

        if (!order) {
            return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
        }

        // Security check: order must belong to user or be a guest order
        if (order.userId && order.userId !== session?.user?.id) {
            return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
        }

        if (order.status !== "PENDING" && order.status !== "WAITING_FOR_PAYMENT") {
            return NextResponse.json({ error: "Sipariş ödeme bekliyor durumunda değil" }, { status: 400 });
        }

        const shippingAddress = order.shippingAddress as any;

        const basketItems: [string, string, number][] = order.items.map((item) => [
            item.productName,
            item.lineTotal.toString(),
            item.quantity,
        ]);

        const tokenData = {
            user_ip: req.headers.get("x-forwarded-for") || "127.0.0.1",
            merchant_oid: order.id,
            email: (order as any).guestEmail || session?.user?.email || "guest@bardakcibike.com.tr",
            payment_amount: Number(order.total),
            user_basket: basketItems,
            user_name: shippingAddress?.name || "Müşteri",
            user_address: shippingAddress?.address || "Adres",
            user_phone: shippingAddress?.phone || "05000000000",
        };

        const result = await getPayTRToken(tokenData);

        if (result.success) {
            return NextResponse.json({ token: result.token });
        } else {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }
    } catch (error) {
        console.error("API PayTR token error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
