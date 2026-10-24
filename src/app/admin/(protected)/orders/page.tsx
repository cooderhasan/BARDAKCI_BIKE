import { prisma } from "@/lib/db";
import { OrdersTable } from "@/components/admin/orders-table";
import { OrderStatus } from "@prisma/client";
import { formatPrice } from "@/lib/helpers";
import { ORDER_SOURCE_LABELS } from "@/lib/order-sources";
import { backfillEInvoiceNumbers } from "@/lib/nes-invoice-number";
import { pttavmRawStatus } from "@/lib/order-status-sync";
import { buildCargoGroups, NO_CARGO_KEY } from "@/lib/cargo-groups";

interface OrdersPageProps {
    searchParams: Promise<{
        page?: string;
        search?: string;
        status?: string;
        cargo?: string;
        source?: string;
        invoice?: string;
        printed?: string;
        customer?: string;
        startDate?: string;
        endDate?: string;
    }>;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
    const params = await searchParams;
    const page = Number(params.page) || 1;
    const limit = 20; // Items per page
    const skip = (page - 1) * limit;

    const search = params.search || "";
    const status = params.status as OrderStatus | string | undefined;
    const cargo = params.cargo;
    const source = params.source;
    const invoice = params.invoice;
    const printed = params.printed;
    const customer = params.customer;
    // Tarihler Türkiye saatine göre gün başı/sonu (sunucu UTC; önceden 00:00-03:00 arası siparişler önceki güne düşüyordu)
    const trDay = (s: string, end: boolean) =>
        /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T${end ? "23:59:59.999" : "00:00:00"}+03:00`) : new Date(s);
    const startDate = params.startDate ? trDay(params.startDate, false) : undefined;
    const endDate = params.endDate ? trDay(params.endDate, true) : undefined;

    // Auto-fix missing marketplace source tags for past orders
    await prisma.order.updateMany({
        where: {
            orderNumber: { startsWith: "IDE", mode: "insensitive" },
            OR: [{ source: null as any }, { source: "WEB" }, { source: "" }],
        },
        data: { source: "IDEFIX" },
    }).catch(() => null);

    // Construct Where Clause
    const andClauses: any[] = [];

    if (search) {
        andClauses.push({
            OR: [
                { id: search },
                { orderNumber: { contains: search, mode: "insensitive" } },
                { user: { email: { contains: search, mode: "insensitive" } } },
                { user: { companyName: { contains: search, mode: "insensitive" } } },
                { guestEmail: { contains: search, mode: "insensitive" } },
            ],
        });
    }

    if (status && status !== "ALL") {
        const normalizedStatus = status.toUpperCase();
        if (Object.values(OrderStatus).includes(normalizedStatus as OrderStatus)) {
            andClauses.push({ status: normalizedStatus as OrderStatus });
        }
    } else if (!status || status === "") {
        // Varsayılan görünüm: "Ödeme Bekleniyor" olanları gizle
        andClauses.push({
            NOT: { status: "WAITING_FOR_PAYMENT" }
        });
    }

    // Marketplace (Source) Filtering
    if (source && source !== "ALL") {
        if (source === "WEB") {
            andClauses.push({ source: "WEB" });
        } else {
            andClauses.push({ source: source });
        }
    }

    // Kargo filtresi: seçenekler siparişlerdeki gerçek kargo adlarından (lib/cargo-groups)
    const cargoRows = await prisma.order
        .groupBy({ by: ["cargoCompany"], _count: { _all: true } })
        .catch(() => [] as { cargoCompany: string | null; _count: { _all: number } }[]);
    const cargoGroups = buildCargoGroups(cargoRows.map((r) => ({ name: r.cargoCompany, count: r._count._all })));
    if (cargo && cargo !== "ALL") {
        if (cargo === NO_CARGO_KEY) {
            andClauses.push({ OR: [{ cargoCompany: null }, { cargoCompany: "" }] });
        } else {
            const group = cargoGroups.find((g) => g.key === cargo);
            // Bilinmeyen değer (eski "OTHER" bağlantısı vb.) filtre uygulamaz
            if (group) andClauses.push({ cargoCompany: { in: group.names } });
        }
    }

    // Invoice Filtering
    if (invoice && invoice !== "ALL") {
        if (invoice === "SENT") {
            andClauses.push({ invoiceNo: { not: null } });
        } else if (invoice === "NONE") {
            andClauses.push({ invoiceNo: null });
        } else if (invoice === "ERROR") {
            andClauses.push({ invoiceStatus: "ERROR" });
        }
    }

    // Printed Filtering
    if (printed && printed !== "ALL") {
        if (printed === "YES") {
            andClauses.push({ isPrinted: true });
        } else if (printed === "NO") {
            andClauses.push({ isPrinted: false });
        }
    }

    // Üye / misafir (misafir: site siparişi, üyelik yok; pazaryeri siparişleri hiçbir zaman üyeye bağlı değil)
    if (customer === "MEMBER") {
        andClauses.push({ userId: { not: null } });
    } else if (customer === "GUEST") {
        andClauses.push({ userId: null, source: "WEB" });
    }

    // Date Filtering
    if (startDate || endDate) {
        const dateFilter: any = {};
        if (startDate) {
            dateFilter.gte = startDate;
        }
        if (endDate) {
            dateFilter.lte = endDate;
        }
        andClauses.push({ createdAt: dateFilter });
    }

    const where = andClauses.length > 0 ? { AND: andClauses } : {};

    // Parallel Fetch: Orders + Total Count
    const [orders, totalCount, summaryGroups] = await Promise.all([
        prisma.order.findMany({
            where,
            include: {
                user: {
                    select: { id: true, companyName: true, email: true, phone: true },
                },
                items: {
                    include: {
                        product: {
                            select: { id: true, sku: true, slug: true, images: true },
                        },
                    },
                },
                payment: true,
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        }),
        prisma.order.count({ where }),
        // Filtreye uyan TÜM siparişlerin (sadece bu sayfanın değil) kaynak/durum bazında adet ve tutarı
        prisma.order.groupBy({
            by: ["source", "status"],
            where,
            _sum: { total: true },
            _count: { _all: true },
        }),
    ]);

    // İptal ve ödemesi tamamlanmamış siparişler ciroya katılmaz, ayrıca gösterilir
    const summary = {
        count: 0, total: 0,
        cancelledCount: 0, cancelledTotal: 0,
        unpaidCount: 0, unpaidTotal: 0,
        bySource: new Map<string, { count: number; total: number }>(),
    };
    for (const g of summaryGroups as any[]) {
        const n = g._count?._all || 0;
        const t = Number(g._sum?.total || 0);
        if (g.status === "CANCELLED") { summary.cancelledCount += n; summary.cancelledTotal += t; continue; }
        if (g.status === "WAITING_FOR_PAYMENT") { summary.unpaidCount += n; summary.unpaidTotal += t; continue; }
        summary.count += n;
        summary.total += t;
        const key = g.source || "WEB";
        const cur = summary.bySource.get(key) || { count: 0, total: 0 };
        summary.bySource.set(key, { count: cur.count + n, total: cur.total + t });
    }
    const sourceLabels = ORDER_SOURCE_LABELS;
    const bySource = Array.from(summary.bySource.entries()).sort((a, b) => b[1].total - a[1].total);

    const totalPages = Math.ceil(totalCount / limit);

    // Üye siparişlerinde "kaçıncı siparişi": iptal edilenler sayılmaz (terk edilen kart ödemeleri sayıyı şişirmesin)
    const memberIds = [...new Set(orders.map((o: any) => o.userId).filter(Boolean))] as string[];
    const memberOrders = memberIds.length
        ? await prisma.order.findMany({
            where: { userId: { in: memberIds } },
            select: { id: true, userId: true, createdAt: true, status: true },
            orderBy: { createdAt: "asc" },
        })
        : [];
    const memberStats = new Map<string, { nth: number; total: number }>();
    for (const uid of memberIds) {
        const list = memberOrders.filter((o) => o.userId === uid);
        const valid = list.filter((o) => o.status !== "CANCELLED");
        for (const o of list) {
            const nth = valid.filter((v) => v.createdAt <= o.createdAt).length + (o.status === "CANCELLED" ? 1 : 0);
            memberStats.set(o.id, { nth, total: valid.length });
        }
    }

    // e-Fatura'da numara yerine sadece seri öneki ("MFB") kalmış siparişler: gerçek numara NES'ten tamamlanır
    const fixedInvoiceNos = await backfillEInvoiceNumbers(orders as any[]);

    // PTT siparişlerinde PTT'nin gönderdiği ham durum (sipariş detayında gösterilir; site ile PTT farklıysa teşhis için)
    const pttNumbers = orders.filter((o: any) => o.source === "PTTAVM").map((o: any) => o.orderNumber);
    const pttRaw = pttNumbers.length
        ? await (prisma as any).pttavmOrder.findMany({ where: { orderNumber: { in: pttNumbers } }, select: { orderNumber: true, rawData: true, updatedAt: true } }).catch(() => [])
        : [];
    const pttStatusByNumber = new Map<string, string>(
        (pttRaw as any[]).map((r) => {
            const raw: any = r.rawData || {};
            const lines = Array.isArray(raw.siparisUrunler) ? raw.siparisUrunler.map((l: any) => l?.siparisDurumu).filter(Boolean) : [];
            // inCargo: 2 = paket tedarikçide (bizde), 3 = PTT şubesinde, 1 = dağıtımda
            const cargoLabel: Record<string, string> = { "1": "1 (dağıtımda)", "2": "2 (bizde)", "3": "3 (PTT şubesi)" };
            const cargo = Array.isArray(raw._cargoInfos)
                ? raw._cargoInfos.map((c: any) => { const v = String(c?.inCargo ?? "boş"); return cargoLabel[v] || v; }).join(", ")
                : null;
            const cargoText = cargo ? ` · kargo yeri: ${cargo}` : "";
            const text = `${pttavmRawStatus(raw) || "-"}${lines.length > 1 ? ` (satırlar: ${lines.join(", ")})` : ""} · barkod: ${raw.kargoBarkod || "yok"}${cargoText} · son çekim: ${new Date(r.updatedAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}`;
            return [r.orderNumber, text];
        })
    );

    const serializedOrders = orders.map((order: any) => ({
        ...order,
        marketplaceStatusText: pttStatusByNumber.get(order.orderNumber) || null,
        invoiceNo: fixedInvoiceNos.get(order.id) ?? order.invoiceNo,
        createdAt: order.createdAt.toISOString(),
        deliveredAt: order.deliveredAt ? order.deliveredAt.toISOString() : null,
        reviewEmailSentAt: order.reviewEmailSentAt ? order.reviewEmailSentAt.toISOString() : null,
        store: order.store || "BIKE",
        guestEmail: order.guestEmail,
        memberOrderNth: memberStats.get(order.id)?.nth ?? null,
        memberOrderTotal: memberStats.get(order.id)?.total ?? null,
        subtotal: Number(order.subtotal),
        discountAmount: Number(order.discountAmount),
        vatAmount: Number(order.vatAmount),
        total: Number(order.total),
        shippingCost: order.shippingCost ? Number(order.shippingCost) : 0,
        shippingDesi: order.shippingDesi ? Number(order.shippingDesi) : 0,
        appliedDiscountRate: Number(order.appliedDiscountRate),
        items: order.items.map((item: any) => ({
            ...item,
            unitPrice: Number(item.unitPrice),
            discountRate: Number(item.discountRate),
            lineTotal: Number(item.lineTotal),
        })),
        payment: order.payment
            ? {
                ...order.payment,
                amount: Number(order.payment.amount),
            }
            : null,
    }));

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Sipariş Yönetimi
                </h2>
                <p className="text-gray-500 dark:text-gray-400">
                    Siparişleri görüntüleyin, arayın ve yönetin.
                </p>
            </div>

            <OrdersTable
                orders={serializedOrders}
                cargoOptions={cargoGroups.map((g) => ({ key: g.key, label: g.label, count: g.count }))}
                pagination={{
                    currentPage: page,
                    totalPages,
                    totalCount,
                }}
            />

            {/* Filtre özeti: seçili tarih/pazaryeri/durum için toplam */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                    <span className="text-sm font-medium text-gray-500">
                        Filtreye uyan siparişler
                        {params.startDate || params.endDate ? ` (${params.startDate || "…"} – ${params.endDate || "…"})` : ""}
                    </span>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                        {summary.count} sipariş · {formatPrice(summary.total)}
                    </span>
                </div>
                {bySource.length > 1 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {bySource.map(([src, v]) => (
                            <span key={src} className="rounded-lg bg-gray-50 px-2.5 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                <span className="font-semibold">{sourceLabels[src] || src}</span>: {v.count} · {formatPrice(v.total)}
                            </span>
                        ))}
                    </div>
                )}
                {(summary.cancelledCount > 0 || summary.unpaidCount > 0) && (
                    <p className="mt-2 text-xs text-gray-500">
                        Toplama dahil değil:
                        {summary.cancelledCount > 0 ? ` ${summary.cancelledCount} iptal (${formatPrice(summary.cancelledTotal)})` : ""}
                        {summary.cancelledCount > 0 && summary.unpaidCount > 0 ? "," : ""}
                        {summary.unpaidCount > 0 ? ` ${summary.unpaidCount} ödeme bekleyen (${formatPrice(summary.unpaidTotal)})` : ""}
                    </p>
                )}
            </div>
        </div>
    );
}
