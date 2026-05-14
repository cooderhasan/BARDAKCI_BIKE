import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSiteSettings } from "@/lib/settings";
import { CheckoutForm } from "@/components/storefront/checkout-form";

export default async function CheckoutPage() {
    const session = await auth();
    let initialData = {};

    if (session?.user?.id) {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                companyName: true,
                phone: true,
                address: true,
                city: true,
                district: true,
                creditLimit: true,
                transactions: {
                    select: {
                        type: true,
                        amount: true,
                    }
                }
            },
        });

        if (user) {
            // Address Info
            initialData = {
                name: user.companyName || "",
                phone: user.phone || "",
                address: user.address || "",
                city: user.city || "",
                district: user.district || "",
            };

            // Current Account Logic
            const totalDebit = user.transactions
                .filter(t => t.type === "DEBIT")
                .reduce((acc, t) => acc + Number(t.amount), 0);

            const totalCredit = user.transactions
                .filter(t => t.type === "CREDIT")
                .reduce((acc, t) => acc + Number(t.amount), 0);

            const currentDebt = totalDebit - totalCredit;
            const creditLimit = Number(user.creditLimit);
            const availableLimit = creditLimit - currentDebt;

            initialData = {
                ...initialData,
                currentAccount: {
                    creditLimit,
                    currentDebt,
                    availableLimit: availableLimit > 0 ? availableLimit : 0
                }
            };
        }
    }

    const cargoCompanies = await prisma.cargoCompany.findMany({
        where: { isActive: true },
        include: { desiPrices: { orderBy: { minDesi: "asc" } } },
        orderBy: { name: "asc" },
    }) as any[]; // Casting to any to bypass Prisma Client lock issues on Windows

    const settings = await getSiteSettings();
    const freeShippingLimit = Number(settings.freeShippingLimit) || 20000;
    const bankTransferDiscount = Number(settings.bankTransferDiscount) || 0;

    // Serialize Decimal fields for Client Component
    const serializedCargoCompanies = cargoCompanies.map(company => ({
        id: company.id,
        name: company.name,
        isDesiActive: !!company.isDesiActive,
        desiPrices: (company.desiPrices || []).map((price: any) => ({
            id: price.id,
            minDesi: Number(price.minDesi),
            maxDesi: Number(price.maxDesi),
            price: Number(price.price),
            multiplierType: price.multiplierType || "FIXED",
        }))
    }));

    return (
        <CheckoutForm
            initialData={initialData}
            cargoCompanies={serializedCargoCompanies}
            freeShippingLimit={freeShippingLimit}
            bankTransferDiscount={bankTransferDiscount}
        />
    );
}
