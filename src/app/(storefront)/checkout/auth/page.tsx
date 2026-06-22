"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogIn, UserPlus, ShoppingBag, ArrowLeft } from "lucide-react";

export default function CheckoutAuthPage() {
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") || "/checkout";

    return (
        <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
            <div className="max-w-4xl w-full space-y-8">
                <div className="text-center">
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
                        Siparişi Tamamlamak İçin Devam Edin
                    </h1>
                    <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">
                        Hızlıca üye girişi yapabilir veya misafir olarak devam edebilirsiniz.
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6 mt-12">
                    {/* Login Option */}
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center text-center group hover:shadow-md transition-shadow">
                        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mb-6 text-[#17457C] transition-transform group-hover:scale-110">
                            <LogIn className="w-8 h-8" />
                        </div>
                        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Giriş Yap</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 flex-1">
                            Hesabınıza giriş yaparak kayıtlı adreslerinizi kullanın ve siparişlerinizi takip edin.
                        </p>
                        <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="w-full">
                            <Button className="w-full rounded-xl bg-[#17457C] hover:bg-[#0f3460] py-6">
                                Giriş Yap
                            </Button>
                        </Link>
                    </div>

                    {/* Register Option */}
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center text-center group hover:shadow-md transition-shadow">
                        <div className="w-16 h-16 bg-purple-50 dark:bg-purple-900/20 rounded-2xl flex items-center justify-center mb-6 text-purple-600 transition-transform group-hover:scale-110">
                            <UserPlus className="w-8 h-8" />
                        </div>
                        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Üye Ol</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 flex-1">
                            Hemen üye olun, avantajlı fiyatlardan ve kampanyalardan anında haberdar olun.
                        </p>
                        <Link href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="w-full">
                            <Button variant="outline" className="w-full rounded-xl border-purple-200 text-purple-600 hover:bg-purple-50 py-6">
                                Üye Ol
                            </Button>
                        </Link>
                    </div>

                    {/* Guest Checkout Option */}
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center text-center group hover:shadow-md transition-shadow">
                        <div className="w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-2xl flex items-center justify-center mb-6 text-green-600 transition-transform group-hover:scale-110">
                            <ShoppingBag className="w-8 h-8" />
                        </div>
                        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Misafir Olarak Devam Et</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 flex-1">
                            Üye olmadan hızlıca siparişinizi tamamlayabilirsiniz.
                        </p>
                        <Link href="/checkout" className="w-full">
                            <Button variant="outline" className="w-full rounded-xl border-green-200 text-green-600 hover:bg-green-50 py-6">
                                Misafir Olarak Devam Et
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="text-center pt-8">
                    <Link href="/cart" className="inline-flex items-center text-gray-500 hover:text-gray-700 transition-colors">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Sepete Geri Dön
                    </Link>
                </div>
            </div>
        </div>
    );
}
