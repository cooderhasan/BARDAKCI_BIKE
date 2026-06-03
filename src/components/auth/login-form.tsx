"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Link from "next/link";
import Image from "next/image";
import { Mail, Lock, LogIn, UserPlus, ArrowRight } from "lucide-react";

interface LoginFormProps {
    logoUrl?: string;
    siteName?: string;
}

export function LoginForm({ logoUrl, siteName }: LoginFormProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;

        try {
            const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                toast.error("E-posta veya şifre hatalı.");
            } else {
                toast.success("Başarıyla giriş yapıldı, yönlendiriliyorsunuz...");
                // Redirect to callbackUrl if present, otherwise to admin/home
                setTimeout(() => {
                    if (callbackUrl) {
                        window.location.href = callbackUrl;
                    } else {
                        window.location.href = "/admin";
                    }
                }, 1500);
            }
        } catch {
            toast.error("Bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md relative">
            {/* Glass Card */}
            <div className="backdrop-blur-xl bg-white/80 dark:bg-gray-800/80 rounded-3xl shadow-2xl border border-white/50 dark:border-gray-700/50 overflow-hidden">
                {/* Header Section */}
                <div className="bg-gradient-to-r from-[#009AD0] to-[#007EA8] px-8 py-10 text-center">
                    {/* Logo */}
                    <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg transform hover:scale-105 transition-transform overflow-hidden relative">
                        {logoUrl ? (
                            <Image
                                src={logoUrl}
                                alt={siteName || "Logo"}
                                fill
                                className="object-contain p-2"
                            />
                        ) : (
                            <span className="text-[#009AD0] font-black text-3xl">
                                {(siteName || "L").charAt(0).toUpperCase()}
                            </span>
                        )}
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-1">
                        Hoş Geldiniz
                    </h1>
                    <p className="text-blue-100 text-sm">
                        Alışverişe başlamak için giriş yapın
                    </p>
                </div>

                {/* Form Section */}
                <div className="px-8 py-8">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Email Field */}
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-gray-700 dark:text-gray-300 font-medium flex items-center gap-2">
                                <Mail className="h-4 w-4 text-[#009AD0]" />
                                E-posta Adresi
                            </Label>
                            <div className="relative">
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="ornek@firma.com"
                                    required
                                    className="h-12 pl-4 pr-4 bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#009AD0]/20 focus:border-[#009AD0] transition-all"
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-gray-700 dark:text-gray-300 font-medium flex items-center gap-2">
                                <Lock className="h-4 w-4 text-[#009AD0]" />
                                Şifre
                            </Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    className="h-12 pl-4 pr-4 bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#009AD0]/20 focus:border-[#009AD0] transition-all"
                                />
                            </div>
                        </div>

                        {/* Forgot Password Link */}
                        <div className="flex justify-end -mt-1">
                            <Link
                                href="/forgot-password"
                                className="text-sm text-[#009AD0] hover:text-[#007EA8] hover:underline transition-colors"
                            >
                                Şifremi Unuttum
                            </Link>
                        </div>

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            className="w-full h-12 bg-gradient-to-r from-[#009AD0] to-[#007EA8] hover:from-[#007EA8] hover:to-[#006282] text-white font-semibold rounded-xl shadow-lg shadow-[#009AD0]/25 hover:shadow-[#009AD0]/40 transition-all duration-300 flex items-center justify-center gap-2"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Giriş yapılıyor...
                                </>
                            ) : (
                                <>
                                    <LogIn className="h-5 w-5" />
                                    Giriş Yap
                                </>
                            )}
                        </Button>
                    </form>

                    {/* Divider */}
                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200 dark:border-gray-600" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-white dark:bg-gray-800 text-gray-500">veya</span>
                        </div>
                    </div>

                    {/* Register Link */}
                    <Link
                        href="/register"
                        className="flex items-center justify-center gap-3 w-full h-12 border-2 border-gray-200 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-[#009AD0] dark:hover:border-[#009AD0]/50 transition-all duration-300 group"
                    >
                        <UserPlus className="h-5 w-5 text-gray-500 group-hover:text-[#009AD0] transition-colors" />
                        Yeni Hesap Oluştur
                        <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-[#009AD0] group-hover:translate-x-1 transition-all" />
                    </Link>
                </div>
            </div>

            {/* Footer Text */}
            <p className="text-center text-sm text-gray-500 mt-6">
                Giriş yaparak{" "}
                <Link href="/policies/distance-sales" className="text-[#009AD0] hover:underline">Kullanım Şartları</Link>
                {" "}ve{" "}
                <Link href="/policies/privacy" className="text-[#009AD0] hover:underline">Gizlilik Politikası</Link>
                'nı kabul etmiş olursunuz.
            </p>
        </div>
    );
}
