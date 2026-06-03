"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Link from "next/link";
import Image from "next/image";
import { Lock, KeyRound, CheckCircle2, AlertTriangle } from "lucide-react";

interface ResetPasswordFormProps {
    logoUrl?: string;
    siteName?: string;
}

export function ResetPasswordForm({ logoUrl, siteName }: ResetPasswordFormProps) {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    // No token provided
    if (!token) {
        return (
            <div className="w-full max-w-md relative">
                <div className="backdrop-blur-xl bg-white/80 dark:bg-gray-800/80 rounded-3xl shadow-2xl border border-white/50 dark:border-gray-700/50 overflow-hidden">
                    <div className="bg-gradient-to-r from-[#009AD0] to-[#007EA8] px-8 py-10 text-center">
                        <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg overflow-hidden relative">
                            {logoUrl ? (
                                <Image src={logoUrl} alt={siteName || "Logo"} fill className="object-contain p-2" />
                            ) : (
                                <span className="text-[#009AD0] font-black text-3xl">
                                    {(siteName || "L").charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-1">Şifre Sıfırla</h1>
                    </div>
                    <div className="px-8 py-8 text-center space-y-4">
                        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto">
                            <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                        </div>
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                            Geçersiz Bağlantı
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Şifre sıfırlama bağlantısı geçersiz veya eksik. Lütfen yeni bir sıfırlama talebi oluşturun.
                        </p>
                        <Link
                            href="/forgot-password"
                            className="inline-flex items-center justify-center gap-2 w-full h-12 bg-gradient-to-r from-[#009AD0] to-[#007EA8] hover:from-[#007EA8] hover:to-[#006282] text-white font-semibold rounded-xl shadow-lg transition-all duration-300"
                        >
                            Yeni Şifre Sıfırlama Talebi
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error("Şifreler eşleşmiyor.");
            return;
        }

        if (password.length < 6) {
            toast.error("Şifre en az 6 karakter olmalıdır.");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                toast.error(data.error || "Bir hata oluştu.");
            } else {
                setSuccess(true);
                toast.success("Şifreniz başarıyla güncellendi!");
            }
        } catch {
            toast.error("Bir hata oluştu. Lütfen tekrar deneyin.");
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
                        Yeni Şifre Belirle
                    </h1>
                    <p className="text-blue-100 text-sm">
                        Hesabınız için yeni bir şifre oluşturun
                    </p>
                </div>

                {/* Form Section */}
                <div className="px-8 py-8">
                    {success ? (
                        /* Success State */
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                            </div>
                            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                                Şifreniz Güncellendi!
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                Şifreniz başarıyla değiştirildi. Yeni şifrenizle giriş yapabilirsiniz.
                            </p>

                            <div className="pt-4">
                                <Link
                                    href="/login"
                                    className="flex items-center justify-center gap-2 w-full h-12 bg-gradient-to-r from-[#009AD0] to-[#007EA8] hover:from-[#007EA8] hover:to-[#006282] text-white font-semibold rounded-xl shadow-lg shadow-[#009AD0]/25 hover:shadow-[#009AD0]/40 transition-all duration-300"
                                >
                                    <KeyRound className="h-5 w-5" />
                                    Giriş Yap
                                </Link>
                            </div>
                        </div>
                    ) : (
                        /* Form State */
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* New Password */}
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-gray-700 dark:text-gray-300 font-medium flex items-center gap-2">
                                    <Lock className="h-4 w-4 text-[#009AD0]" />
                                    Yeni Şifre
                                </Label>
                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="h-12 pl-4 pr-4 bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#009AD0]/20 focus:border-[#009AD0] transition-all"
                                />
                            </div>

                            {/* Confirm Password */}
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword" className="text-gray-700 dark:text-gray-300 font-medium flex items-center gap-2">
                                    <Lock className="h-4 w-4 text-[#009AD0]" />
                                    Şifre Tekrar
                                </Label>
                                <Input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="h-12 pl-4 pr-4 bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#009AD0]/20 focus:border-[#009AD0] transition-all"
                                />
                                {confirmPassword && password !== confirmPassword && (
                                    <p className="text-xs text-red-500 mt-1">Şifreler eşleşmiyor</p>
                                )}
                            </div>

                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Şifreniz en az 6 karakter olmalıdır.
                            </p>

                            {/* Submit Button */}
                            <Button
                                type="submit"
                                className="w-full h-12 bg-gradient-to-r from-[#009AD0] to-[#007EA8] hover:from-[#007EA8] hover:to-[#006282] text-white font-semibold rounded-xl shadow-lg shadow-[#009AD0]/25 hover:shadow-[#009AD0]/40 transition-all duration-300 flex items-center justify-center gap-2"
                                disabled={loading || (!!confirmPassword && password !== confirmPassword)}
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Güncelleniyor...
                                    </>
                                ) : (
                                    <>
                                        <KeyRound className="h-5 w-5" />
                                        Şifremi Güncelle
                                    </>
                                )}
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
