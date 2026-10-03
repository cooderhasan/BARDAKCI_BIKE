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
    const [googleLoading, setGoogleLoading] = useState(false);

    const handleGoogleSignIn = async () => {
        setGoogleLoading(true);
        try {
            await signIn("google", {
                callbackUrl: callbackUrl || "/account",
            });
        } catch (error) {
            console.error("GOOGLE_SIGNIN_CLICK_ERROR:", error);
            toast.error("Google ile giriş başlatılamadı.");
            setGoogleLoading(false);
        }
    };

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
                <div className="bg-gradient-to-r from-[#17457C] to-[#0f3460] px-8 py-10 text-center">
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
                            <span className="text-[#17457C] font-black text-3xl">
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
                                <Mail className="h-4 w-4 text-[#17457C]" />
                                E-posta Adresi
                            </Label>
                            <div className="relative">
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="ornek@firma.com"
                                    required
                                    className="h-12 pl-4 pr-4 bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#17457C]/20 focus:border-[#17457C] transition-all"
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-gray-700 dark:text-gray-300 font-medium flex items-center gap-2">
                                <Lock className="h-4 w-4 text-[#17457C]" />
                                Şifre
                            </Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    className="h-12 pl-4 pr-4 bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#17457C]/20 focus:border-[#17457C] transition-all"
                                />
                            </div>
                        </div>

                        {/* Forgot Password Link */}
                        <div className="flex justify-end -mt-1">
                            <Link
                                href="/forgot-password"
                                className="text-sm text-[#17457C] hover:text-[#0f3460] hover:underline transition-colors"
                            >
                                Şifremi Unuttum
                            </Link>
                        </div>

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            className="w-full h-12 bg-gradient-to-r from-[#17457C] to-[#0f3460] hover:from-[#0f3460] hover:to-[#006282] text-white font-semibold rounded-xl shadow-lg shadow-[#17457C]/25 hover:shadow-[#17457C]/40 transition-all duration-300 flex items-center justify-center gap-2"
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
                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200 dark:border-gray-600" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-white dark:bg-gray-800 text-gray-500">veya</span>
                        </div>
                    </div>

                    {/* Google Sign In */}
                    <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={loading || googleLoading}
                        className="w-full h-12 bg-white dark:bg-gray-700/80 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-xl border border-gray-300 dark:border-gray-600 shadow-sm transition-all duration-200 flex items-center justify-center gap-3 hover:shadow-md cursor-pointer disabled:opacity-50"
                    >
                        {googleLoading ? (
                            <div className="w-5 h-5 border-2 border-gray-300 border-t-[#17457C] rounded-full animate-spin" />
                        ) : (
                            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                                <path
                                    fill="#4285F4"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="#34A853"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="#FBBC05"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                                />
                                <path
                                    fill="#EA4335"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                                />
                            </svg>
                        )}
                        <span>Google ile Giriş Yap</span>
                    </button>

                    {/* Register Link */}
                    <div className="mt-4">
                        <Link
                            href="/register"
                            className="flex items-center justify-center gap-3 w-full h-12 border-2 border-gray-200 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-[#17457C] dark:hover:border-[#17457C]/50 transition-all duration-300 group"
                        >
                            <UserPlus className="h-5 w-5 text-gray-500 group-hover:text-[#17457C] transition-colors" />
                            Yeni Hesap Oluştur
                            <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-[#17457C] group-hover:translate-x-1 transition-all" />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Footer Text */}
            <p className="text-center text-sm text-gray-500 mt-6">
                Giriş yaparak{" "}
                <Link href="/policies/distance-sales" className="text-[#17457C] hover:underline">Kullanım Şartları</Link>
                {" "}ve{" "}
                <Link href="/policies/privacy" className="text-[#17457C] hover:underline">Gizlilik Politikası</Link>
                'nı kabul etmiş olursunuz.
            </p>
        </div>
    );
}
