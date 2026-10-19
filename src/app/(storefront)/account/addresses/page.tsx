import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { AddressBook } from "@/components/storefront/address-book";
import { getMyAddresses } from "./actions";

export const dynamic = "force-dynamic";

export default async function AddressesPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login?callbackUrl=/account/addresses");
    }

    // Adres defteri; eski tek adres ilk açılışta varsayılan adres olarak aktarılır
    const addresses = await getMyAddresses();
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, companyName: true },
    });

    return <AddressBook addresses={addresses} defaultName={user?.companyName || user?.name || ""} />;
}
