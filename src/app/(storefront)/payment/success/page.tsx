"use client";

import { useEffect } from "react";
import { useCartStore } from "@/stores/cart-store";
import { CheckCircle2, ShoppingBag, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function PaymentSuccessPage() {
    const { clearCart } = useCartStore();

    useEffect(() => {
        // Clear cart on successful payment redirection
        clearCart();
    }, [clearCart]);

    return (
        <div className="container mx-auto px-4 py-24">
            <div className="max-w-md mx-auto text-center space-y-6">
                <div className="flex justify-center">
                    <div className="bg-green-100 p-4 rounded-full">
                        <CheckCircle2 className="h-16 w-16 text-green-600" />
                    </div>
                </div>

                <h1 className="text-3xl font-bold text-gray-900">Ödeme Başarılı!</h1>
                <p className="text-gray-600">
                    Siparişiniz başarıyla alındı ve ödemeniz onaylandı.
                    Müşteri temsilcilerimiz en kısa sürede hazırlıklara başlayacaktır.
                </p>

                <div className="pt-8 flex flex-col gap-3">
                    <Link href="/account/orders">
                        <Button className="w-full bg-[#17457C] hover:bg-[#0f3460] h-12 text-lg">
                            Siparişlerime Git
                            <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                    </Link>
                    <Link href="/">
                        <Button variant="outline" className="w-full h-12">
                            <ShoppingBag className="mr-2 h-5 w-5" />
                            Alışverişe Devam Et
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
