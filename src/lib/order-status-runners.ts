import { prisma } from "@/lib/db";
import {
    advanceOrderStatus,
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

    // 1) Dokümandaki "kargoya verilen" ve "teslim edilen" paket listeleri (son 1 ay, sipariş numarasıyla).
    //    Sipariş detayındaki kalem durumu beklenen alanda gelmeyebildiği için esas yol bu (2026-10-16: teslim edilmiş
    //    sipariş detaydan ilerletilemedi).
    let listChecked = 0;
    let listAdvanced = 0;
    for (const [state, next] of [["delivered", "DELIVERED"], ["shipped", "SHIPPED"]] as const) {
        for (let page = 0; page < 20; page++) {
            let rows: any[] = [];
            try {
                rows = await client.getPackagesByState(state, page * 50, 50);
            } catch (e: any) {
                console.warn(`[status-sync] HB ${state} listesi:`, e?.message);
                break;
            }
            if (rows.length === 0) break;
            const nums = Array.from(new Set(rows.map((r) => String(r?.orderNumber ?? r?.OrderNumber ?? "").trim()).filter(Boolean)));
            if (nums.length > 0) {
                const orders = await prisma.order.findMany({
                    where: { source: "HEPSIBURADA", orderNumber: { in: nums }, status: { in: ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED"] } },
                    select: { id: true, status: true },
                });
                for (const o of orders) {
                    listChecked++;
                    if (await advanceOrderStatus(o, next)) listAdvanced++;
                }
            }
            if (rows.length < 50) break;
            await new Promise((r) => setTimeout(r, 300));
        }
    }
    if (listAdvanced > 0) console.log(`[status-sync] HEPSIBURADA (listeler): ${listChecked} eşleşme, ${listAdvanced} ilerletildi`);

    // 2) Listelerde olmayan (1 aydan eski vb.) takılı siparişler tek tek: önce paket durumu (Intransit/Delivered),
    //    yoksa sipariş detayındaki kalem durumu
    const single = await catchUpStaleOrders("HEPSIBURADA", async ({ orderNumber, shipmentPackageId }) => {
        let pkgNo = shipmentPackageId && /^\d{6,}$/.test(shipmentPackageId) ? shipmentPackageId : null;
        let detailItems: any[] = [];
        if (!pkgNo) {
            const detail: any = await client.getOrderByNumber(orderNumber);
            detailItems = detail?.items || (Array.isArray(detail) ? detail : []);
            const pn = detailItems.map((i) => String(i?.packageNumber || "")).find((x) => /^\d{6,}$/.test(x));
            pkgNo = pn || null;
        }
        if (pkgNo) {
            const info = await client.getPackageCargoInfo(pkgNo);
            const st = String(info?.status || "").toLowerCase();
            if (st === "delivered") return "DELIVERED";
            if (st === "intransit" || st === "shipped") return "SHIPPED";
        }
        return leastAdvanced(detailItems.map((i) => mapHepsiburadaItemStatus(i?.status ?? i?.orderStatus)));
    });

    return { checked: listChecked + single.checked, advanced: listAdvanced + single.advanced };
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
