"use server";
import { requireAdmin } from "@/lib/admin-guard";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// Müşteri: Havale bildirimi gönder
export async function submitBankTransferNotification(data: {
  orderId: string;
  senderName: string;
  bankName: string;
  amount: number;
  transferDate: string;
  notes?: string;
}) {
  const session = await auth();

  // Siparişi doğrula
  const order = await prisma.order.findUnique({
    where: { id: data.orderId },
    include: { payment: true },
  });

  if (!order) return { success: false, message: "Sipariş bulunamadı." };

  // Kullanıcı kontrolü
  if (session?.user?.id && order.userId !== session.user.id) {
    return { success: false, message: "Bu sipariş size ait değil." };
  }

  // Ödeme yöntemi kontrolü
  if (order.payment?.method !== "BANK_TRANSFER") {
    return { success: false, message: "Bu sipariş havale ile ödenmemiş." };
  }

  try {
    await (prisma as any).bankTransferNotification.create({
      data: {
        orderId: data.orderId,
        userId: session?.user?.id || null,
        senderName: data.senderName,
        bankName: data.bankName,
        amount: data.amount,
        transferDate: new Date(data.transferDate),
        notes: data.notes || null,
        status: "PENDING",
      },
    });

    // revalidatePath(`/orders/${data.orderId}`);
    // revalidatePath(`/account/orders/${data.orderId}`);
    return { success: true, message: "Havale bildiriminiz alındı. En kısa sürede onaylanacaktır." };
  } catch (error: any) {
    return { success: false, message: "Hata: " + error.message };
  }
}

// Admin: Tüm havale bildirimlerini listele
export async function getBankTransferNotifications(status?: string) {
  await requireAdmin();
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
    return [];
  }

  try {
    const where: any = {};
    if (status && status !== "ALL") {
      where.status = status;
    }

    return await (prisma as any).bankTransferNotification.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            status: true,
            user: { select: { companyName: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}

// Admin: Bildirimi onayla
export async function confirmBankTransfer(notificationId: string) {
  await requireAdmin();
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
    return { success: false, message: "Yetersiz yetki." };
  }

  try {
    const notification = await (prisma as any).bankTransferNotification.findUnique({
      where: { id: notificationId },
      include: { order: { include: { payment: true } } },
    });

    if (!notification) return { success: false, message: "Bildirim bulunamadı." };

    // Transaction ile bildirim + ödeme + sipariş güncelle
    await prisma.$transaction(async (tx: any) => {
      // Bildirimi onayla
      await tx.bankTransferNotification.update({
        where: { id: notificationId },
        data: { status: "CONFIRMED" },
      });

      // Ödemeyi tamamla
      if (notification.order.payment) {
        await tx.payment.update({
          where: { id: notification.order.payment.id },
          data: { status: "COMPLETED" },
        });
      }

      // Siparişi onayla
      await tx.order.update({
        where: { id: notification.orderId },
        data: { status: "CONFIRMED" },
      });
    });

    revalidatePath("/admin/bank-transfers");
    return { success: true, message: "Havale onaylandı, sipariş durumu güncellendi." };
  } catch (error: any) {
    return { success: false, message: "Hata: " + error.message };
  }
}

// Admin: Bildirimi reddet
export async function rejectBankTransfer(notificationId: string, adminNote?: string) {
  await requireAdmin();
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
    return { success: false, message: "Yetersiz yetki." };
  }

  try {
    await (prisma as any).bankTransferNotification.update({
      where: { id: notificationId },
      data: {
        status: "REJECTED",
        adminNote: adminNote || "Havale bilgisi eşleşmedi.",
      },
    });

    revalidatePath("/admin/bank-transfers");
    return { success: true, message: "Bildirim reddedildi." };
  } catch (error: any) {
    return { success: false, message: "Hata: " + error.message };
  }
}

// Müşteri: Siparişin havale bildirimlerini getir
export async function getOrderBankTransfers(orderId: string) {
  await requireAdmin();
  try {
    return await (prisma as any).bankTransferNotification.findMany({
      where: { orderId },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}
