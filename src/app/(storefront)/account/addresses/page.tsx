import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Plus } from "lucide-react";
import { EditAddressDialog } from "@/components/storefront/edit-address-dialog";

export default async function AddressesPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login?callbackUrl=/account/addresses");
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold mb-2">Adreslerim</h1>
                    <p className="text-gray-500">Teslimat adreslerinizi buradan yönetebilirsiniz.</p>
                </div>
                {/* <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Yeni Adres Ekle
                </Button> */}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Default Address (from User model) */}
                <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-900/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Varsayılan Adres</CardTitle>
                        <MapPin className="h-4 w-4 text-[#17457C]" />
                    </CardHeader>
                    <CardContent>
                        <div className="mt-2 space-y-1 text-sm">
                            <p className="font-semibold">{user?.companyName}</p>
                            <p>{user?.address}</p>
                            <p>{user?.district} / {user?.city}</p>
                            <p>{user?.phone}</p>
                        </div>
                        <div className="mt-4 flex gap-2">
                            <EditAddressDialog
                                initialData={{
                                    address: user?.address,
                                    city: user?.city,
                                    district: user?.district,
                                    phone: user?.phone,
                                }}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 text-sm">
                <p>Not: Şu anda sadece tek bir fatura ve teslimat adresi desteklenmektedir. Yeni adres ekleme özelliği yakında aktif olacaktır.</p>
            </div>
        </div>
    );
}
