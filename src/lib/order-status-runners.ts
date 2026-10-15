import { prisma } from "@/lib/db";
import {
    catchUpStaleOrders,
    leastAdvanced,
    mapHepsiburadaItemStatus,
    mapIdefixStatus,
    mapPazaramaItemStatus,
    mapN11PackageStatus,
} from "@/lib/order-status-sync";

/**
 * Kuyruktaki sipariş senkronlarının ardından çalışır: o pazaryerinde durumu takılı kalmış siparişleri
 * pazaryerine sorup İLERİ taşır. Kurallar için lib/order-status-sync.ts.
 * Hepsi hata yakalar; sipariş senkronunu asla bozmaz.
 */

export async function runHepsiburadaStatusCatchUp() {
    const config = await (prisma as any).hepsiburadaConfig.findFirst({ where: { isActive: true } });
    if (!config) return { checked: 0, advanced: 0 };
    const { HepsiburadaClient } = await import("@/services/hepsiburada/api");
    const client = new HepsiburadaClient({
        username: config.username,
        password: config.password,
        merchantId: config.merchantId,
        isTestMode: config.isTestMode ?? false,
    });
    // Sipariş detayı: kalem bazında status (Open, Packaged, InTransit, Delivered, iptaller)
    return catchUpStaleOrders("HEPSIBURADA", async ({ orderNumber }) => {
        const detail: any = await client.getOrderByNumber(orderNumber);
        const items: any[] = detail?.items || (Array.isArray(detail) ? detail : []);
        return leastAdvanced(items.map((i) => mapHepsiburadaItemStatus(i?.status ?? i?.orderStatus)));
    });
}

export async function runIdefixStatusCatchUp() {
    const config = await (prisma as any).idefixConfig.findFirst({ where: { isActive: true } });
    if (!config) return { checked: 0, advanced: 0 };
    const { IdefixClient } = await import("@/services/idefix/api");
    const client = new IdefixClient({
        apiKey: config.apiKey,
        apiSecret: config.apiSecret,
        vendorId: config.vendorId,
        isTestMode: Boolean(config.isTestMode),
    });
    // Sevkiyat listesi sipariş numarasıyla sorgulanır; status: shipment_in_cargo, shipment_delivered...
    return catchUpStaleOrders("IDEFIX", async ({ orderNumber }) => {
        const res: any = await client.getOrders({ orderNumber, limit: 10 });
        const shipments: any[] = res?.items ?? [];
        return leastAdvanced(shipments.map((sh) => mapIdefixStatus(sh?.status ?? sh?.state)));
    });
}

export async function runPazaramaStatusCatchUp() {
    const config = await (prisma as any).pazaramaConfig.findFirst({ where: { isActive: true } });
    if (!config) return { checked: 0, advanced: 0 };
    const { PazaramaClient } = await import("@/services/pazarama/api");
    const client = new PazaramaClient(config);
    // Sipariş numarasıyla sorgu 6 aya kadar geriye gider (dokümana göre)
    return catchUpStaleOrders("PAZARAMA", async ({ orderNumber }) => {
        const n = parseInt(orderNumber, 10);
        if (!n) return null;
        const orders: any[] = await client.getOrders({ orderNumber: n });
        const o = (orders || []).find((x: any) => String(x?.orderNumber) === String(orderNumber));
        if (!o) return null;
        // Kalem durumları esas (sipariş seviyesindeki durum güncellenmeyebiliyor); iptal/iade kalemleri yok sayılır
        return leastAdvanced((o.itemStatuses || []).map(mapPazaramaItemStatus));
    }, { delayMs: 1000 });
}

/**
 * N11: sipariş numarasıyla paket sorgusu (dokümana göre). Tarih verilmezse sadece son 15 gün döndüğü için
 * siparişin oluşturulma tarihi etrafında 14 günlük aralık verilir. Bölünmüş siparişte en az ilerlemiş paket esas.
 */
export async function runN11StatusCatchUp() {
    const config = await (prisma as any).n11Config.findFirst();
    if (!config) return { checked: 0, advanced: 0 };
    const { N11Client } = await import("@/services/n11/api");
    const client = new N11Client({ apiKey: config.apiKey, apiSecret: config.apiSecret });
    const DAY = 24 * 60 * 60 * 1000;
    return catchUpStaleOrders("N11", async ({ orderNumber, createdAt }) => {
        const start = createdAt.getTime() - 2 * DAY;
        const end = Math.min(createdAt.getTime() + 12 * DAY, Date.now() + DAY);
        const pkgs = await client.getPackagesByOrderNumber(orderNumber, start, end);
        const mine = pkgs.filter((p: any) => String(p?.orderNumber || "") === String(orderNumber));
        return leastAdvanced(mine.map((p: any) => mapN11PackageStatus(p?.shipmentPackageStatus)));
    });
}
