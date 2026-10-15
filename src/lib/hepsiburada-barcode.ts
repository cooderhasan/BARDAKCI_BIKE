import { prisma } from "@/lib/db";
import { HepsiburadaClient } from "@/services/hepsiburada/api";

type HbOrderLike = {
    id: string;
    orderNumber: string;
    source?: string | null;
    cargoTrackingNumber?: string | null;
    shipmentPackageId?: string | null;
};

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
    Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("zaman aşımı")), ms))]);

/** HB paket numarası rakamlardan oluşur; eski kayıtlarda shipmentPackageId'de kalem GUID'i olabilir */
const looksLikePackageNumber = (v?: string | null) => !!v && /^\d{6,}$/.test(v);

/**
 * Hepsiburada siparişinin kargo barkodunu (HB etiketindeki barkod) döndürür.
 * Kayıtta yoksa HB'den çeker ve siparişe yazar; paketlenmemişse veya HB'ye ulaşılamazsa null.
 * Kargo firması etiketi bu barkodla okuduğu için sipariş numarası yerine bu basılmalı.
 */
export async function resolveHepsiburadaCargoBarcode(order: HbOrderLike): Promise<string | null> {
    if (order.source !== "HEPSIBURADA") return null;
    if (order.cargoTrackingNumber) return order.cargoTrackingNumber;

    try {
        const config = await (prisma as any).hepsiburadaConfig.findFirst({ where: { isActive: true } });
        if (!config) return null;
        const client = new HepsiburadaClient({
            username: config.username,
            password: config.password,
            merchantId: config.merchantId,
            isTestMode: config.isTestMode ?? false,
        });

        let packageNumber = looksLikePackageNumber(order.shipmentPackageId) ? order.shipmentPackageId! : null;
        if (!packageNumber) {
            const detail: any = await withTimeout(client.getOrderByNumber(order.orderNumber), 8000);
            const items: any[] = detail?.items || (Array.isArray(detail) ? detail : []);
            const pn = items.map((i) => i?.packageNumber).find((x) => looksLikePackageNumber(String(x || "")));
            packageNumber = pn ? String(pn) : null;
        }
        if (!packageNumber) return null; // HB'de henüz paketlenmemiş

        const info = await withTimeout(client.getPackageCargoInfo(packageNumber), 8000);
        const barcode = info?.barcode || null;
        if (!barcode) return null;

        await prisma.order.update({
            where: { id: order.id },
            data: { cargoTrackingNumber: barcode, shipmentPackageId: packageNumber },
        });
        return barcode;
    } catch (e: any) {
        console.warn(`HB kargo barkodu alınamadı (${order.orderNumber}):`, e?.message);
        return null;
    }
}
