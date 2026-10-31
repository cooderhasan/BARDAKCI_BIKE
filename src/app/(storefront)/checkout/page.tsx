import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSiteSettings } from "@/lib/settings";
import { getCargoPricing } from "@/lib/cargo-pricing";
import { CheckoutForm } from "@/components/storefront/checkout-form";
import { getMyAddresses } from "@/app/(storefront)/account/addresses/actions";

export default async function CheckoutPage() {
    const session = await auth();
    let initialData = {};

    if (session?.user?.id) {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                name: true,
                companyName: true,
                taxNumber: true,
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
            // Bireysel üyede firma adı boş; önceden sadece firma adı alındığı için ad soyad boş geliyordu
            initialData = {
                isLoggedIn: true,
                name: user.companyName || user.name || "",
                taxNumber: user.taxNumber || "",
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

    // Üyenin adres defteri (ödemede tek tıkla seçilir)
    const savedAddresses = session?.user?.id ? await getMyAddresses().catch(() => []) : [];

    const settings = await getSiteSettings();
    const { cargoCompanies, freeShippingLimit } = await getCargoPricing();
    const bankTransferDiscount = Number(settings.bankTransferDiscount) || 0;

    return (
        <CheckoutForm
            initialData={initialData}
            savedAddresses={savedAddresses}
            cargoCompanies={cargoCompanies}
            freeShippingLimit={freeShippingLimit}
            bankTransferDiscount={bankTransferDiscount}
        />
    );
}
