import { Queue, Worker, Job } from "bullmq";
import redisConnection from "./redis";
import { prisma } from "@/lib/db";

/**
 * Otomatik e-fatura kuyruğu (NES).
 *
 * Site siparişi (bisiklet + Moto Vitrin, source WEB) admin panelinden "Kargolandı" yapılınca
 * fatura kuyruğa girer ve NES'e tek tek, aralarında 7 sn olacak şekilde gönderilir.
 * (Kargo toplayıcısı gelince onlarca sipariş 2-3 dakikada kargolandı yapılıyor; NES'e topluca gitmesin.)
 *
 * Pazaryeri siparişleri şimdilik dahil DEĞİL: faturalarını Entegra kesiyor (çift fatura olmasın).
 * Faturayı, Siparişler ekranındaki e-fatura butonunun çağırdığı fonksiyonun aynısı keser.
 */

const INVOICE_QUEUE = "invoice-queue";
const GAP_MS = 7000;

let invoiceQueue: Queue | null = null;
let invoiceWorker: Worker | null = null;

function getInvoiceQueue() {
    if (!invoiceQueue) invoiceQueue = new Queue(INVOICE_QUEUE, { connection: redisConnection });
    return invoiceQueue;
}

/** Otomatik faturaya uygun sipariş: kendi sitemizin siparişi, kargolandı, faturası yok */
function isEligible(o: { source: string | null; status: string; invoiceNo: string | null }) {
    return (!o.source || o.source === "WEB") && o.status === "SHIPPED" && !o.invoiceNo;
}

/**
 * Kargolandı yapılan site siparişlerini fatura kuyruğuna ekler. Hata olursa sipariş durumu değişikliğini bozmaz.
 */
export async function enqueueAutoInvoices(orderIds: string[]) {
    try {
        if (orderIds.length === 0) return;
        const orders = await prisma.order.findMany({
            where: { id: { in: orderIds } },
            select: { id: true, source: true, status: true, invoiceNo: true, orderNumber: true },
        });
        const eligible = orders.filter((o) => isEligible(o as any));
        if (eligible.length === 0) return;
        const queue = getInvoiceQueue();
        for (const o of eligible) {
            // jobId: aynı sipariş kuyrukta zaten bekliyorsa ikinci kez eklenmez
            await queue.add(
                "nes-invoice",
                { orderId: o.id },
                {
                    jobId: `invoice-${o.id}`,
                    attempts: 4,
                    backoff: { type: "exponential", delay: 60_000 }, // 1, 2, 4 dk sonra tekrar
                    removeOnComplete: true,
                    removeOnFail: 200,
                }
            );
        }
        console.log(`🧾 Otomatik fatura kuyruğuna eklendi: ${eligible.map((o) => o.orderNumber).join(", ")}`);
    } catch (e: any) {
        console.error("Otomatik fatura kuyruğa eklenemedi:", e?.message);
    }
}

export function initializeInvoiceWorker() {
    if (invoiceWorker) return;
    invoiceWorker = new Worker(
        INVOICE_QUEUE,
        async (job: Job<{ orderId: string }>) => {
            const order = await prisma.order.findUnique({
                where: { id: job.data.orderId },
                select: { id: true, source: true, status: true, invoiceNo: true, orderNumber: true },
            });
            // Kuyrukta beklerken elle kesildiyse, durum değiştiyse veya silindiyse atla
            if (!order || !isEligible(order as any)) {
                console.log(`🧾 Otomatik fatura atlandı (${order?.orderNumber || job.data.orderId}): uygun değil veya zaten kesilmiş`);
                return;
            }
            const { sendOrderInvoiceNes } = await import("@/app/admin/(protected)/integrations/nes-efatura/actions");
            const result: any = await sendOrderInvoiceNes(order.id);
            if (result?.success) {
                console.log(`🧾 Otomatik fatura kesildi: ${order.orderNumber} — ${result.message}`);
                return;
            }
            if (/zaten fatura kesilmiş/i.test(result?.message || "")) return;
            // Tekrar denensin (NES geçici hata / limit). Son denemede de olmazsa sipariş "fatura hatası"nda kalır.
            throw new Error(result?.message || "NES fatura hatası");
        },
        {
            connection: redisConnection,
            concurrency: 1,
            limiter: { max: 1, duration: GAP_MS },
        }
    );
    invoiceWorker.on("failed", (job, err) => {
        console.error(`⚠️ Otomatik fatura başarısız (${job?.data?.orderId}, deneme ${job?.attemptsMade}): ${err.message}`);
    });
    console.log("🧾 Otomatik fatura kuyruğu başlatıldı.");
}
