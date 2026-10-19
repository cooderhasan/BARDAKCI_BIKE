"use client";

import { XCircle, RefreshCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PaymentFailPage() {
    const router = useRouter();

    return (
        <div className="container mx-auto px-4 py-24">
            <div className="max-w-md mx-auto text-center space-y-6">
                <div className="flex justify-center">
                    <div className="bg-red-100 p-4 rounded-full">
                        <XCircle className="h-16 w-16 text-red-600" />
                    </div>
                </div>

                <h1 className="text-3xl font-bold text-gray-900">Ödeme Başarısız</h1>
                <p className="text-gray-600">
                    Üzgünüz, ödeme işlemi sırasında bir sorun oluştu veya işlem iptal edildi.
                    Lütfen bilgilerinizi kontrol edip tekrar deneyin.
                </p>

                <div className="pt-8 flex flex-col gap-3">
                    {/* Başarısız ödemede sipariş iptal edilip stok iade ediliyor; geri dönmek iptal siparişin ödeme
                        ekranını açıp hata veriyordu. Sepet dolu kaldığı için ödeme sayfasından yeniden denenir. */}
                    <Button
                        onClick={() => {
                            const target = "/checkout";
                            // PayTR iframe içinde açıldıysa üst pencereyi yönlendir
                            if (window.top && window.top !== window.self) window.top.location.href = target;
                            else router.push(target);
                        }}
                        className="w-full bg-red-600 hover:bg-red-700 h-12 text-lg"
                    >
                        <RefreshCcw className="mr-2 h-5 w-5" />
                        Tekrar Dene
                    </Button>
                    <Link href="/">
                        <Button variant="outline" className="w-full h-12">
                            <Home className="mr-2 h-5 w-5" />
                            Ana Sayfaya Dön
                        </Button>
                    </Link>
                </div>

                <div className="text-xs text-gray-400 mt-8">
                    Sorun devam ederse lütfen bankanızla veya bizimle iletişime geçin.
                </div>
            </div>
        </div>
    );
}
