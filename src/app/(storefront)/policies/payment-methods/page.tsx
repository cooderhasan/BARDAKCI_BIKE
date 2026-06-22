import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, CreditCard } from "lucide-react";

export default function PaymentMethodsPage() {
    return (
        <div className="container mx-auto px-4 py-12">
            <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">Ödeme Şekilleri</h1>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building2 className="h-6 w-6 text-[#17457C]" />
                            Havale / EFT
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-gray-600 dark:text-gray-300">
                            Siparişinizi oluşturduktan sonra belirtilen banka hesaplarımıza Havale veya EFT ile ödeme yapabilirsiniz. Ödeme açıklama kısmına sipariş numaranızı yazmayı unutmayınız.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CreditCard className="h-6 w-6 text-purple-600" />
                            Kredi Kartı
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-gray-600 dark:text-gray-300">
                            Anlaşmalı olduğumuz bankaların kredi kartları ile güvenli bir şekilde tek çekim veya taksitli alışveriş yapabilirsiniz. (Çok yakında hizmetinizde)
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
