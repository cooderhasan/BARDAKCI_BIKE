import { prisma } from "@/lib/db";
import {
    advanceOrderStatus,
    catchUpStaleOrders,
    leastAdvanced,
    mapHepsiburadaItemStatus,
    mapIdefixStatus,
    mapPazaramaItemStatus,
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
 * N11: paket listesi durum filtresiyle (Shipped / Delivered) çekilir ve eşleşen siparişler ilerletilir.
 * Filtre geçersizse liste boş/hatalı döner ve hiçbir şey değişmez.
 */
export async function runN11StatusCatchUp() {
    const config = await (prisma as any).n11Config.findFirst();
    if (!config) return { checked: 0, advanced: 0 };
    const { N11Client } = await import("@/services/n11/api");
    const client = new N11Client({ apiKey: config.apiKey, apiSecret: config.apiSecret });

    let checked = 0;
    let advanced = 0;
    const lists: Array<{ status: string; next: "SHIPPED" | "DELIVERED" }> = [
        { status: "Shipped", next: "SHIPPED" },
        { status: "Delivered", next: "DELIVERED" },
    ];
    for (const { status, next } of lists) {
        for (let page = 0; page < 5; page++) {
            let res: any;
            try {
                res = await client.getOrders(status, page);
            } catch {
                break;
            }
            const pkgs: any[] = res?.success === false ? [] : (res?.content || []);
            if (pkgs.length === 0) break;
            for (const pkg of pkgs) {
                const orderNum = String(pkg?.orderNumber || "").trim();
                const pkgId = String(pkg?.id || "").trim();
                if (!orderNum && !pkgId) continue;
                const order = await prisma.order.findFirst({
                    where: {
                        source: "N11",
                        status: { in: ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED"] },
                        OR: [
                            ...(orderNum ? [{ orderNumber: orderNum }] : []),
                            ...(pkgId ? [{ shipmentPackageId: pkgId }] : []),
                        ],
                    },
                    select: { id: true, status: true },
                });
                if (!order) continue;
                checked++;
                if (await advanceOrderStatus(order, next)) advanced++;
            }
            if (pkgs.length < 100) break;
            await new Promise((r) => setTimeout(r, 500));
        }
    }
    if (advanced > 0) console.log(`[status-sync] N11: ${checked} kontrol, ${advanced} ilerletildi`);
    return { checked, advanced };
}
