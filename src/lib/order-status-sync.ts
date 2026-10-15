import { prisma } from "@/lib/db";
import type { OrderStatus } from "@prisma/client";

/**
 * Pazaryeri siparişlerinin durumunu pazaryerindeki gerçek duruma göre İLERİ taşır.
 *
 * Güvenlik kuralları:
 * - Durum sadece ileri gider: Onaylandı → Hazırlanıyor → Kargolandı → Teslim Edildi. Asla geri gitmez.
 * - İptal / ödeme bekleyen siparişlere dokunulmaz; pazaryerinde iptal görünse de burada iptal edilmez
 *   (iptal stok iadesi gerektirir, o akış ayrı).
 * - Stoğa dokunulmaz.
 *
 * Neden: HB/N11/Idefix/Pazarama importları siparişi bir kez aktarıyor, sonraki durum değişikliklerini
 * almıyordu; yüzlerce sipariş "Onaylandı"da kalıyordu (2026-10-15'te 625 adet).
 */

const RANK: Record<string, number> = { PENDING: 0, CONFIRMED: 1, PROCESSING: 2, SHIPPED: 3, DELIVERED: 4 };
type Forward = "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED";

/** En az ilerlemiş kalemin durumu (çok kalemli siparişte hepsi kargolanmadan "Kargolandı" denmez) */
export function leastAdvanced(statuses: (Forward | null)[]): Forward | null {
    const valid = statuses.filter((s): s is Forward => !!s);
    if (valid.length === 0) return null;
    return valid.reduce((a, b) => (RANK[a] <= RANK[b] ? a : b));
}

/** Durumu sadece ileri taşır; değiştiyse true */
export async function advanceOrderStatus(order: { id: string; status: OrderStatus | string }, next: Forward | null): Promise<boolean> {
    if (!next) return false;
    const cur = RANK[String(order.status)];
    if (cur === undefined) return false; // CANCELLED / WAITING_FOR_PAYMENT
    if (RANK[next] <= cur) return false;
    await prisma.order.update({
        where: { id: order.id },
        data: { status: next as OrderStatus, ...(next === "DELIVERED" ? { deliveredAt: new Date() } : {}) },
    });
    return true;
}

/**
 * Durumu takılı kalmış olabilecek siparişler: 6 saatten eski, Onaylandı/Hazırlanıyor/Beklemede.
 * En uzun süredir kontrol edilmeyenden başlar (updatedAt), kontrol edilenin updatedAt'i güncellenir;
 * böylece her senkronda sıradaki siparişlere bakılır.
 */
export async function getStaleOrders(source: string, limit = 25) {
    return prisma.order.findMany({
        where: {
            source,
            status: { in: ["PENDING", "CONFIRMED", "PROCESSING"] },
            createdAt: { lt: new Date(Date.now() - 6 * 60 * 60 * 1000), gt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { updatedAt: "asc" },
        take: limit,
        select: { id: true, orderNumber: true, status: true, shipmentPackageId: true },
    });
}

export async function markChecked(orderId: string) {
    await prisma.order.update({ where: { id: orderId }, data: { updatedAt: new Date() } }).catch(() => {});
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Bir pazaryerinin takılı siparişlerini tek tek sorgulayıp ilerletir.
 * resolve: sipariş numarasından pazaryerindeki ileri durumu döndürür (bilinmiyorsa null).
 * Hata olursa senkronu bozmaz.
 */
export async function catchUpStaleOrders(
    source: string,
    resolve: (order: { orderNumber: string; shipmentPackageId: string | null }) => Promise<Forward | null>,
    opts: { limit?: number; delayMs?: number } = {},
): Promise<{ checked: number; advanced: number }> {
    let checked = 0;
    let advanced = 0;
    try {
        const stale = await getStaleOrders(source, opts.limit ?? 25);
        for (const o of stale) {
            try {
                const next = await resolve({ orderNumber: o.orderNumber, shipmentPackageId: o.shipmentPackageId });
                checked++;
                if (await advanceOrderStatus(o, next)) advanced++;
                else await markChecked(o.id);
            } catch (e: any) {
                console.warn(`[status-sync] ${source} ${o.orderNumber}:`, e?.message);
                await markChecked(o.id);
            }
            await sleep(opts.delayMs ?? 300);
        }
    } catch (e: any) {
        console.warn(`[status-sync] ${source} genel hata:`, e?.message);
    }
    if (advanced > 0) console.log(`[status-sync] ${source}: ${checked} kontrol, ${advanced} ilerletildi`);
    return { checked, advanced };
}

// ---- Pazaryeri durum eşlemeleri ----

/** Hepsiburada sipariş detayı kalem durumu */
export function mapHepsiburadaItemStatus(s: any): Forward | null {
    const v = String(s || "").toLowerCase();
    if (v === "open" || v === "unpacked") return "CONFIRMED";
    if (v === "packaged" || v === "readytoship") return "PROCESSING";
    if (v === "intransit" || v === "shipped") return "SHIPPED";
    if (v === "delivered") return "DELIVERED";
    return null; // iptal, talep (claim) vb.
}

/** Idefix shipment status (dokümandaki değerler) */
export function mapIdefixStatus(s: any): Forward | null {
    const v = String(s || "").toLowerCase();
    if (v === "created" || v === "shipment_ready") return "CONFIRMED";
    if (v === "shipment_picking" || v === "shipment_invoiced") return "PROCESSING";
    if (v === "shipment_in_cargo") return "SHIPPED";
    if (v === "shipment_delivered" || v === "shipment_approved") return "DELIVERED";
    return null; // iptal, temin edilemedi, teslim edilemedi, bölündü
}

/** Pazarama kalem durumu (orderItemStatus): 3 Alındı, 12 Hazırlanıyor, 5 Kargoya Verildi, 16/19 Mağazada/Teslimat noktasında, 11 Teslim */
export function mapPazaramaItemStatus(s: any): Forward | null {
    const v = String(s ?? "").trim();
    if (v === "3") return "CONFIRMED";
    if (v === "12") return "PROCESSING";
    if (v === "5" || v === "16" || v === "19") return "SHIPPED";
    if (v === "11") return "DELIVERED";
    return null; // iptal, iade, tedarik edilemedi, teslim edilemedi
}

export function orderStatusRank(s: string): number | undefined {
    return RANK[s];
}
