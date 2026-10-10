/**
 * "Gelince Haber Ver": stoğa giren ürünler için bekleyen müşterilere günde bir kez e-posta gönderir.
 * Stok hangi yoldan artarsa artsın (elle, iade, Excel, paket) yakalansın diye olay yerine günlük tarama yapılır.
 */
import { prisma } from "@/lib/db";
import { sendBackInStockEmail } from "@/lib/email";

const SITE_URLS: Record<"BIKE" | "MOTOR", string> = {
    BIKE: "https://www.bardakcibike.com.tr",
    MOTOR: "https://www.motovitrin.com",
};

// Resend ücretsiz planı günde 100 e-posta; sipariş/kargo e-postalarına yer kalsın diye günlük üst sınır
const DAILY_LIMIT = Number(process.env.STOCK_NOTIFY_DAILY_LIMIT || 40);

function startOfTodayIstanbul(): Date {
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" }); // YYYY-MM-DD
    return new Date(`${day}T00:00:00+03:00`);
}

export async function processStockNotifications(): Promise<{ sent: number; failed: number; deferred: number; message: string }> {
    const sentToday = await prisma.stockNotification.count({ where: { notifiedAt: { gte: startOfTodayIstanbul() } } });
    let remaining = DAILY_LIMIT - sentToday;
    if (remaining <= 0) {
        return { sent: 0, failed: 0, deferred: 0, message: `Günlük sınır (${DAILY_LIMIT}) dolu, yarın devam edilecek.` };
    }

    // Motovitrin sitesi henüz yayında değil: şimdilik yalnızca Bardakcı Bike talepleri işlenir
    const pending = await prisma.stockNotification.findMany({
        where: { notifiedAt: null, store: "BIKE", product: { isActive: true } },
        orderBy: { createdAt: "asc" },
        take: 2000,
        include: {
            product: {
                select: {
                    name: true, slug: true, images: true, stock: true, listPrice: true, salePrice: true,
                    variants: { select: { id: true, stock: true, color: true, size: true } },
                },
            },
        },
    });

    let sent = 0;
    let failed = 0;
    let deferred = 0;
    for (const n of pending) {
        const p = n.product;
        const variant = n.variantId ? p.variants.find((v) => v.id === n.variantId) : null;
        const inStock = variant ? variant.stock > 0 : p.stock > 0;
        if (!inStock) continue;
        if (remaining <= 0) { deferred++; continue; }

        const siteUrl = SITE_URLS[n.store === "MOTOR" ? "MOTOR" : "BIKE"];
        const rawImage = p.images?.[0] || null;
        const imageUrl = rawImage ? (rawImage.startsWith("http") ? rawImage : `${siteUrl}${rawImage.startsWith("/") ? "" : "/"}${rawImage}`) : null;
        const price = Number(p.salePrice ?? p.listPrice ?? 0) || null;
        const variantLabel = variant ? [variant.color, variant.size].filter(Boolean).join(" / ") || null : null;

        const res = await sendBackInStockEmail({
            to: n.email,
            productName: p.name,
            productUrl: `${siteUrl}/products/${p.slug}`,
            imageUrl,
            price,
            variantLabel,
            store: n.store === "MOTOR" ? "MOTOR" : "BIKE",
        });
        if (res.success) {
            await prisma.stockNotification.update({ where: { id: n.id }, data: { notifiedAt: new Date() } });
            sent++;
            remaining--;
        } else {
            failed++;
        }
        await new Promise((r) => setTimeout(r, 600)); // Resend saniyede 2 istek sınırı
    }

    return {
        sent,
        failed,
        deferred,
        message: `${sent} "stoğa geldi" e-postası gönderildi${failed ? `, ${failed} başarısız` : ""}${deferred ? `, ${deferred} tanesi günlük sınır yüzünden yarına kaldı` : ""}.`,
    };
}
