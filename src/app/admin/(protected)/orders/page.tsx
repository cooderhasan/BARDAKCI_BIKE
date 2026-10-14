import { prisma } from "@/lib/db";
import { OrdersTable } from "@/components/admin/orders-table";
import { OrderStatus } from "@prisma/client";
import { formatPrice } from "@/lib/helpers";
import { ORDER_SOURCE_LABELS } from "@/lib/order-sources";

interface OrdersPageProps {
    searchParams: Promise<{
        page?: string;
        search?: string;
        status?: string;
        cargo?: string;
        source?: string;
        invoice?: string;
        printed?: string;
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

    // Cargo Filtering
    if (cargo && cargo !== "ALL") {
        if (cargo === "YURTICI") {
            andClauses.push({
                OR: [
                    { cargoCompany: { contains: "Yurt", mode: "insensitive" } },
                    { cargoCompany: { contains: "Yü", mode: "insensitive" } }
                ]
            });
        } else if (cargo === "ARAS") {
            andClauses.push({
                cargoCompany: { contains: "Aras", mode: "insensitive" }
            });
        } else if (cargo === "OTHER") {
            andClauses.push({
                AND: [
                    { NOT: { cargoCompany: { contains: "Yurt", mode: "insensitive" } } },
                    { NOT: { cargoCompany: { contains: "Aras", mode: "insensitive" } } },
                    { NOT: { cargoCompany: null } }
                ]
            });
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

    const serializedOrders = orders.map((order: any) => ({
        ...order,
        createdAt: order.createdAt.toISOString(),
        deliveredAt: order.deliveredAt ? order.deliveredAt.toISOString() : null,
        reviewEmailSentAt: order.reviewEmailSentAt ? order.reviewEmailSentAt.toISOString() : null,
        store: order.store || "BIKE",
        guestEmail: order.guestEmail,
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
