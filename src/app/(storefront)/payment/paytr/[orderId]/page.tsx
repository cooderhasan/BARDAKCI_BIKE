"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Script from "next/script";

interface PaymentPageProps {
    params: Promise<{ orderId: string }>;
}

export default function PayTRPaymentPage({ params }: PaymentPageProps) {
    const { orderId } = use(params);
    const router = useRouter();
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchToken() {
            try {
                const response = await fetch("/api/payment/paytr/token", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ orderId }),
                });

                const data = await response.json();

                if (response.ok) {
                    setToken(data.token);
                } else {
                    setError(data.error || "Ödeme token'ı alınamadı");
                }
            } catch (err) {
                console.error("Fetch token error:", err);
                setError("Sistem hatası oluştu. Lütfen tekrar deneyin.");
            } finally {
                setLoading(false);
            }
        }

        fetchToken();
    }, [orderId]);

    return (
        <div className="container mx-auto px-4 py-12">
            <div className="max-w-4xl mx-auto">
                <Link
                    href="/cart"
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Sepete Dön
                </Link>

                <Card className="shadow-xl">
                    <CardHeader className="bg-gray-50 dark:bg-gray-800 border-b">
                        <CardTitle className="flex items-center justify-between">
                            <span>Güvenli Ödeme Ekranı</span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 font-normal uppercase tracking-wider">Powered by</span>
                                <span className="font-bold text-[#17457C] italic">PayTR</span>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 min-h-[600px] flex flex-col items-center justify-center relative">
                        {loading && (
                            <div className="flex flex-col items-center gap-4">
                                <Loader2 className="h-10 w-10 text-[#17457C] animate-spin" />
                                <p className="text-gray-500">Ödeme ekranı alınıyor, lütfen bekleyin...</p>
                            </div>
                        )}

                        {error && (
                            <div className="p-8 text-center">
                                <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4 border border-red-100">
                                    {error}
                                </div>
                                <Button onClick={() => router.back()} variant="outline">
                                    Geri Dön
                                </Button>
                            </div>
                        )}

                        {token && (
                            <div className="w-full h-full min-h-[600px]">
                                <Script
                                    src="https://www.paytr.com/js/iframeResizer.min.js"
                                    onLoad={() => {
                                        // @ts-ignore
                                        if (window.iFrameResize) {
                                            // @ts-ignore
                                            window.iFrameResize({}, "#paytriframe");
                                        }
                                    }}
                                />
                                <iframe
                                    src={`https://www.paytr.com/odeme/guvenli/${token}`}
                                    id="paytriframe"
                                    frameBorder="0"
                                    scrolling="no"
                                    style={{ width: "100%", minHeight: "600px" }}
                                ></iframe>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="mt-6 text-center text-sm text-gray-400">
                    <p>Ödemeniz 256-bit SSL güvencesiyle PayTR altyapısı üzerinden gerçekleştirilmektedir.</p>
                </div>
            </div>
        </div>
    );
}
