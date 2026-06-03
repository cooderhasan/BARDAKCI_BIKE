"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Link from "next/link";
import Image from "next/image";
import { Mail, ArrowLeft, Send, CheckCircle2 } from "lucide-react";

interface ForgotPasswordFormProps {
    logoUrl?: string;
    siteName?: string;
}

export function ForgotPasswordForm({ logoUrl, siteName }: ForgotPasswordFormProps) {
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [email, setEmail] = useState("");

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (!response.ok) {
                toast.error(data.error || "Bir hata oluştu.");
            } else {
                setSent(true);
                toast.success("Şifre sıfırlama bağlantısı gönderildi!");
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
                        Şifremi Unuttum
                    </h1>
                    <p className="text-blue-100 text-sm">
                        Kayıtlı e-posta adresinizi girin
                    </p>
                </div>

                {/* Form Section */}
                <div className="px-8 py-8">
                    {sent ? (
                        /* Success State */
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                            </div>
                            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                                E-posta Gönderildi!
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                <strong>{email}</strong> adresine şifre sıfırlama
                                bağlantısı gönderdik. Lütfen gelen kutunuzu
                                kontrol edin.
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                                E-posta gelmediyse spam/gereksiz klasörünü kontrol edin.
                            </p>

                            {/* Divider */}
                            <div className="relative my-6">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200 dark:border-gray-600" />
                                </div>
                            </div>

                            <Link
                                href="/login"
                                className="flex items-center justify-center gap-2 w-full h-12 bg-gradient-to-r from-[#009AD0] to-[#007EA8] hover:from-[#007EA8] hover:to-[#006282] text-white font-semibold rounded-xl shadow-lg shadow-[#009AD0]/25 hover:shadow-[#009AD0]/40 transition-all duration-300"
                            >
                                <ArrowLeft className="h-5 w-5" />
                                Giriş Sayfasına Dön
                            </Link>
                        </div>
                    ) : (
                        /* Form State */
                        <>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center leading-relaxed">
                                Hesabınıza kayıtlı e-posta adresini girin.
                                Size şifre sıfırlama bağlantısı göndereceğiz.
                            </p>

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
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="h-12 pl-4 pr-4 bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-[#009AD0]/20 focus:border-[#009AD0] transition-all"
                                        />
                                    </div>
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
                                            Gönderiliyor...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="h-5 w-5" />
                                            Sıfırlama Bağlantısı Gönder
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

                            {/* Back to Login */}
                            <Link
                                href="/login"
                                className="flex items-center justify-center gap-3 w-full h-12 border-2 border-gray-200 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-[#009AD0] dark:hover:border-[#009AD0]/50 transition-all duration-300 group"
                            >
                                <ArrowLeft className="h-5 w-5 text-gray-500 group-hover:text-[#009AD0] transition-colors" />
                                Giriş Sayfasına Dön
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
