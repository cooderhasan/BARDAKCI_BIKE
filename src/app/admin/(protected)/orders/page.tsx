import { prisma } from "@/lib/db";
import { OrdersTable } from "@/components/admin/orders-table";
import { OrderStatus } from "@prisma/client";

interface OrdersPageProps {
    searchParams: Promise<{
        page?: string;
        search?: string;
        status?: string;
        cargo?: string;
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
    const startDate = params.startDate ? new Date(params.startDate) : undefined;
    const endDate = params.endDate ? new Date(params.endDate) : undefined;

    // Construct Where Clause
    const where: any = {};

    if (search) {
        where.OR = [
            { orderNumber: { contains: search, mode: "insensitive" } },
            { user: { email: { contains: search, mode: "insensitive" } } },
            { user: { companyName: { contains: search, mode: "insensitive" } } },
            { guestEmail: { contains: search, mode: "insensitive" } },
        ];
    }

    if (status && status !== "ALL") {
        const normalizedStatus = status.toUpperCase();
        if (Object.values(OrderStatus).includes(normalizedStatus as OrderStatus)) {
            where.status = normalizedStatus as OrderStatus;
        }
    } else if (!status || status === "") {
        // Varsayılan görünüm (filtre yok): "Ödeme Bekleniyor" olanları gizle (Başarısız/Yarım kalan PayTR işlemleri)
        where.NOT = {
            status: "WAITING_FOR_PAYMENT"
        };
    }
    // status === "ALL" ise hiçbir filtre ekleme - tüm durumları göster

    // Marketplace (Source) Filtering
    if (source && source !== "ALL") {
        if (source === "WEB") {
            where.OR = [
                { source: null },
                { source: "WEB" }
            ];
        } else {
            where.source = source;
        }
    }

    // Cargo Filtering
    if (cargo && cargo !== "ALL") {
        if (!where.AND) where.AND = [];
        
        if (cargo === "YURTICI") {
            where.AND.push({
                OR: [
                    { cargoCompany: { contains: "Yurt", mode: "insensitive" } },
                    { cargoCompany: { contains: "Yü", mode: "insensitive" } }
                ]
            });
        } else if (cargo === "ARAS") {
            where.AND.push({
                cargoCompany: { contains: "Aras", mode: "insensitive" }
            });
        } else if (cargo === "OTHER") {
            where.AND.push({
                AND: [
                    { NOT: { cargoCompany: { contains: "Yurt", mode: "insensitive" } } },
                    { NOT: { cargoCompany: { contains: "Aras", mode: "insensitive" } } },
                    { NOT: { cargoCompany: null } }
                ]
            });
        }
    }

    // Date Filtering
    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
            where.createdAt.gte = startDate;
        }
        if (endDate) {
            // End date'i günün sonuna ayarla (23:59:59)
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            where.createdAt.lte = endOfDay;
        }
    }

    // Parallel Fetch: Orders + Total Count
    const [orders, totalCount] = await Promise.all([
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
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    const serializedOrders = orders.map((order: any) => ({
        ...order,
        createdAt: order.createdAt.toISOString(),
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
        </div>
    );
}
