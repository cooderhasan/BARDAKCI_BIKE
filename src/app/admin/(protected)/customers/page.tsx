import { prisma } from "@/lib/db";
import { CustomersTable } from "@/components/admin/customers-table";

interface CustomersPageProps {
    searchParams: Promise<{
        page?: string;
        search?: string;
        role?: string;
    }>;
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
    const params = await searchParams;
    const page = Number(params.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    const search = params.search || "";
    const role = params.role;

    const where: any = {
        role: { in: ["CUSTOMER", "DEALER"] },
    };

    if (search) {
        where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { companyName: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
        ];
    }

    if (role && role !== "ALL") {
        where.role = role;
    }

    const [customers, totalCount] = await Promise.all([
        prisma.user.findMany({
            where,
            include: {
                discountGroup: true,
                transactions: {
                    select: {
                        type: true,
                        amount: true,
                    }
                },
                _count: {
                    select: { orders: true },
                },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        }),
        prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    const discountGroups = await prisma.discountGroup.findMany({
        where: { isActive: true },
        orderBy: { discountRate: "asc" },
    });

    const serializedCustomers = customers.map(customer => {
        const totalDebit = customer.transactions
            .filter(t => t.type === "DEBIT")
            .reduce((acc, t) => acc + Number(t.amount), 0);

        const totalCredit = customer.transactions
            .filter(t => t.type === "CREDIT")
            .reduce((acc, t) => acc + Number(t.amount), 0);

        const currentDebt = totalDebit - totalCredit;

        // Destructure to separate Decimal fields and exclude raw transactions
        const { transactions, creditLimit, riskLimit, discountGroup, ...otherFields } = customer;

        return {
            ...otherFields,
            creditLimit: Number(creditLimit),
            riskLimit: Number(riskLimit),
            currentDebt,
            availableLimit: Number(creditLimit) - currentDebt,
            discountGroup: discountGroup ? {
                ...discountGroup,
                discountRate: Number(discountGroup.discountRate)
            } : null
        };
    });

    const serializedDiscountGroups = discountGroups.map(group => ({
        ...group,
        discountRate: Number(group.discountRate)
    }));

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                    Müşteri Yönetimi
                </h2>
                <p className="text-gray-500 dark:text-gray-400">
                    Bayi onayı ve iskonto grubu ataması yapın.
                </p>
            </div>

            <CustomersTable 
                customers={serializedCustomers} 
                discountGroups={serializedDiscountGroups} 
                pagination={{
                    currentPage: page,
                    totalPages,
                    totalCount,
                }}
            />
        </div>
    );
}
