import { prisma } from "@/lib/db";

/**
 * Yarım bırakılan kartlı siparişleri iptal eder ve stoğu iade eder.
 *
 * Kartlı siparişte stok sipariş oluşurken düşülüyor (WAITING_FOR_PAYMENT) ve pazaryerlerine bildiriliyor.
 * PayTR başarısız ödemede "failed" bildirimi gönderiyor (callback iptal edip stoğu iade ediyor), ama müşteri ödeme
 * ekranını hiç denemeden kapatırsa bildirim gelmiyor; sipariş askıda, stok düşük kalıyordu.
 *
 * PayTR ödeme ekranı 30 dakikada zaman aşımına uğruyor (lib/paytr.ts timeout_limit); güvenli pay ile 90 dakikadan
 * eski (son güncellemeden itibaren; havaleden karta çevrilen sipariş çevrildiği an güncellenir) siparişler iptal edilir.
 * Geç gelen başarılı ödeme bildirimi, iptal edilmiş siparişi stoğu yeniden düşerek onaylar (paytr/callback).
 */
// Bu temizlik 2026-10-19'da eklendi. Daha eski askıda siparişlere dokunulmaz: o günden beri stokları elle / senkronla
// düzeltilmiş olabilir, iade etmek stoğu şişirir (onlar admin'de "Ödeme Bekleniyor" filtresinden elle kapatılır).
const CLEANUP_START = new Date("2026-10-19T00:00:00+03:00");

export async function cancelAbandonedCardOrders(maxAgeMinutes = 90): Promise<{ cancelled: number; message: string }> {
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    const orders = await prisma.order.findMany({
        where: {
            status: "WAITING_FOR_PAYMENT",
            source: "WEB",
            updatedAt: { lt: cutoff, gte: CLEANUP_START },
        },
        include: { items: true, payment: true },
        take: 50,
    });

    const { restoreOrderStock, handlePostOrderStockSync } = await import("@/lib/stock-sync");
    const affected = new Set<string>();
    let cancelled = 0;

    for (const order of orders) {
        if (order.payment?.status === "COMPLETED") continue;
        try {
            const ids = await prisma.$transaction(async (tx) => {
                // Bu arada ödeme bildirimi geldiyse dokunma (durum hâlâ WAITING_FOR_PAYMENT ise iptal et)
                const res = await tx.order.updateMany({
                    where: { id: order.id, status: "WAITING_FOR_PAYMENT" },
                    data: {
                        status: "CANCELLED",
                        notes: (order.notes ? order.notes + " | " : "") + "Kart ödemesi tamamlanmadı (zaman aşımı), otomatik iptal edildi.",
                    },
                });
                if (res.count === 0) return [] as string[];
                if (order.payment) {
                    await tx.payment.update({ where: { orderId: order.id }, data: { status: "FAILED" } });
                }
                cancelled++;
                return restoreOrderStock(tx, order.items);
            });
            ids.forEach((id) => affected.add(id));
        } catch (e) {
            console.error(`Yarım kalan kart siparişi iptal edilemedi (${order.orderNumber}):`, e);
        }
    }

    if (affected.size > 0) {
        handlePostOrderStockSync([...affected], "site").catch(console.error);
    }
    return { cancelled, message: `${cancelled} yarım kalan kart siparişi iptal edildi, stok iade edildi.` };
}
