import { prisma } from "@/lib/db";
import { NesClient } from "@/services/nes/api";

/**
 * e-Fatura'larda fatura numarası yerine sadece seri öneki ("MFB") kaydedilmiş siparişler (2026-10-21/22, düzeltme öncesi):
 * gerçek numara NES'ten alınıp kaydedilir. Sipariş listesi açılınca o sayfadaki siparişler için çalışır; bir kez düzelince
 * tekrar sorgulanmaz.
 */
export async function backfillEInvoiceNumbers(
    orders: Array<{ id: string; invoiceNo?: string | null; invoiceId?: string | null; invoiceUrl?: string | null }>
): Promise<Map<string, string>> {
    const fixed = new Map<string, string>();
    const pending = orders
        .filter((o) => o.invoiceId && o.invoiceNo && /^[A-Z0-9]{3}$/.test(o.invoiceNo) && (o.invoiceUrl || "").includes("OutgoingInvoice"))
        .slice(0, 10);
    if (pending.length === 0) return fixed;

    try {
        const config = await (prisma as any).nesEInvoiceConfig.findFirst({ where: { isActive: true } });
        if (!config) return fixed;
        const client = new NesClient({
            apiKey: config.apiKey,
            senderAlias: config.senderAlias,
            senderVkn: config.senderVkn,
            senderTitle: config.senderTitle,
            senderAddress: config.senderAddress,
            senderCity: config.senderCity,
            senderDistrict: config.senderDistrict,
            taxOffice: config.taxOffice,
            sourceApp: config.sourceApp,
            isTestMode: config.isTestMode,
        });
        for (const o of pending) {
            const no = await client.getEInvoiceNumber(o.invoiceId!);
            if (no && no.length > 3) {
                await prisma.order.update({ where: { id: o.id }, data: { invoiceNo: no } });
                fixed.set(o.id, no);
            }
        }
    } catch (e: any) {
        console.warn("e-Fatura numarası tamamlanamadı:", e?.message);
    }
    return fixed;
}
