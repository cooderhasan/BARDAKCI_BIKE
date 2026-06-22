"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { authenticateAdmin } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2, Mail, Lock, Shield, KeyRound } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <Button
            className="w-full h-12 bg-[#17457C] bg-gradient-to-r from-blue-600 to-indigo-600 hover:bg-[#0f3460] hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 flex items-center justify-center gap-2"
            type="submit"
            disabled={pending}
        >
            {pending ? (
                <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Giriş Yapılıyor...
                </>
            ) : (
                <>
                    <KeyRound className="h-5 w-5" />
                    Yönetici Girişi
                </>
            )}
        </Button>
    );
}

export default function AdminLoginPage() {
    const [errorMessage, dispatch] = useActionState(authenticateAdmin, undefined);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 px-4 py-8 relative overflow-hidden">
            {/* Animated Background Grid */}
            <div className="absolute inset-0 opacity-20">
                <div className="absolute inset-0" style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
                    backgroundSize: '40px 40px'
                }} />
            </div>

            {/* Decorative Gradients */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />

            {/* Subtle moving particles effect via CSS */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-blue-400/50 rounded-full animate-pulse" />
                <div className="absolute top-3/4 right-1/4 w-2 h-2 bg-indigo-400/50 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
                <div className="absolute top-1/2 right-1/3 w-1 h-1 bg-white/30 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
            </div>

            <div className="max-w-md w-full relative z-10">
                {/* Glass Card */}
                <div className="bg-gray-800/95 supports-[backdrop-filter]:bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-3xl shadow-2xl overflow-hidden">
                    {/* Header Section */}
                    <div className="px-8 pt-10 pb-8 text-center relative">
                        {/* Shield Icon */}
                        <div className="w-20 h-20 bg-[#17457C] bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/30 transform hover:scale-105 transition-transform">
                            <Shield className="h-10 w-10 text-white" />
                        </div>

                        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
                            Yönetim Paneli
                        </h1>
                        <p className="text-gray-400 text-sm">
                            Sadece yetkili personel girişi içindir
                        </p>

                        {/* Security Badge */}
                        <div className="flex items-center justify-center gap-2 mt-4 px-4 py-2 bg-gray-700/50 rounded-full inline-flex mx-auto">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-xs text-gray-400">Güvenli Bağlantı</span>
                        </div>
                    </div>

                    {/* Form Section */}
                    <div className="px-8 pb-10">
                        <form action={dispatch} className="space-y-5">
                            {/* Email Field */}
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-gray-300 font-medium flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-blue-400" />
                                    Email Adresi
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        required
                                        className="h-12 bg-gray-700/50 border-gray-600 text-white placeholder-gray-500 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                                        placeholder="admin@example.com"
                                    />
                                </div>
                            </div>

                            {/* Password Field */}
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-gray-300 font-medium flex items-center gap-2">
                                    <Lock className="h-4 w-4 text-blue-400" />
                                    Şifre
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        name="password"
                                        type="password"
                                        autoComplete="current-password"
                                        required
                                        className="h-12 bg-gray-700/50 border-gray-600 text-white placeholder-gray-500 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            {/* Error Alert */}
                            {errorMessage && (
                                <Alert variant="destructive" className="bg-red-900/30 border-red-800/50 text-red-200 rounded-xl">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle className="font-semibold">Giriş Başarısız</AlertTitle>
                                    <AlertDescription className="text-red-300/80">{errorMessage}</AlertDescription>
                                </Alert>
                            )}

                            {/* Submit Button */}
                            <div className="pt-2">
                                <SubmitButton />
                            </div>
                        </form>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 text-center space-y-1">
                    <p className="text-gray-500 text-sm">
                        B2B Yönetim Sistemi © {new Date().getFullYear()}
                    </p>
                    <p className="text-gray-600 text-xs">
                        Coded by{" "}
                        <a
                            href="https://www.hasandurmus.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            Hasan Durmuş
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
