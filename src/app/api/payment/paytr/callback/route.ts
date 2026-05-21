import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPayTRCallback } from "@/lib/paytr";
import { sendOrderConfirmationEmail, sendAdminNewOrderEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const params: any = {};
        formData.forEach((value, key) => {
            params[key] = value;
        });

        console.log("PayTR Callback received:", params.merchant_oid, params.status);

        // 1. Verify Hash
        if (!verifyPayTRCallback(params)) {
            console.error("PayTR Callback Hash mismatch!");
            return new NextResponse("PAYTR_HASH_MISMATCH", { status: 400 });
        }

        const orderId = params.merchant_oid; // This is the merchant_oid from PayTR
        const status = params.status; // success or failed
        const total_amount = params.total_amount; // Assuming total_amount is provided by PayTR

        if (status === "success") {
            // 2. Update Order and Payment status
            // merchant_oid is sent as order.id in the token route
            const order = await prisma.order.findFirst({
                where: {
                    OR: [
                        { id: orderId },           // Primary: matches order.id (sent as merchant_oid)
                        { orderNumber: orderId },   // Fallback: matches orderNumber (legacy)
                    ]
                },
                include: {
                    payment: true,
                    items: true,
                    user: true,
                },
            });

            if (!order) {
                console.error(`Sipariş bulunamadı: ${orderId}`);
                return new NextResponse("OK");
            }

            // Ödeme Başarılı
            await prisma.order.update({
                where: { id: order.id },
                data: { status: "CONFIRMED" },
            });

            await prisma.payment.upsert({
                where: { orderId: order.id },
                update: {
                    status: "COMPLETED",
                    amount: Number(total_amount) / 100,
                    providerRef: orderId,
                    providerData: params as any,
                },
                create: {
                    orderId: order.id,
                    method: "CREDIT_CARD",
                    status: "COMPLETED",
                    amount: Number(total_amount) / 100,
                    providerRef: orderId,
                    providerData: params as any,
                },
            });
            console.log(`Order ${orderId} confirmed via PayTR`);

            // --- SEND EMAILS (Now that payment is confirmed) ---
            try {
                const shippingAddress = order.shippingAddress as any; // Cast JSON to any
                const emailTo = order.user?.email || order.guestEmail;
                const emailItems = order.items.map((item) => ({
                    productName: item.productName,
                    quantity: item.quantity,
                    unitPrice: Number(item.unitPrice),
                    lineTotal: Number(item.lineTotal),
                    variantInfo: item.variantInfo || undefined,
                }));

                if (emailTo) {
                    await sendOrderConfirmationEmail({
                        to: emailTo,
                        orderNumber: order.orderNumber,
                        customerName: shippingAddress?.name || "Değerli Müşterimiz",
                        items: emailItems,
                        totalAmount: Number(order.total),
                        paymentMethod: "CREDIT_CARD",
                        shippingAddress: {
                            address: shippingAddress?.address || "",
                            city: shippingAddress?.city || "",
                            district: shippingAddress?.district || "",
                        },
                        cargoCompany: order.cargoCompany || undefined,
                    });
                }

                // Send admin notification
                await sendAdminNewOrderEmail({
                    orderNumber: order.orderNumber,
                    customerName: shippingAddress?.name || "Misafir",
                    companyName: order.user?.companyName || shippingAddress?.name || "Misafir",
                    totalAmount: Number(order.total),
                    orderId: order.id,
                    cargoCompany: order.cargoCompany || undefined,
                    items: emailItems,
                });

                console.log(`Emails sent for Order ${orderId}`);
            } catch (emailErr) {
                console.error(`Failed to send emails for Order ${orderId}:`, emailErr);
                // Don't fail the request, just log it
            }
        } else {
            // Payment failed
            console.log(`Order ${orderId} payment failed:`, params.failed_reason_msg);
            // Hatayı nota ekle ama statüyü değiştirme (Böylece WAITING_FOR_PAYMENT kalır ve panelde gizli kalmaya devam eder)
            // Ayrıca 'where' sorgusunu orderNumber olarak düzeltiyoruz (id değil)
            const orderForFail = await prisma.order.findFirst({
                where: {
                    OR: [
                        { id: orderId },
                        { orderNumber: orderId },
                    ]
                }
            });
            if (orderForFail) {
                await prisma.order.update({
                    where: { id: orderForFail.id },
                    data: {
                        notes: (orderForFail.notes ? orderForFail.notes + " | " : "") + `PayTR Hatası: ${params.failed_reason_msg}`
                    },
                });
            }
        }

        // 3. Return OK to PayTR
        return new NextResponse("OK");
    } catch (error) {
        console.error("PayTR Callback Error:", error);
        return new NextResponse("INTERNAL_SERVER_ERROR", { status: 500 });
    }
}
