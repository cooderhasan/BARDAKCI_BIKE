"use client";

import { useState } from "react";
import { Loader2, Copy, Check, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { regenerateBackupCodes } from "./actions";

export function BackupCodesPanel({ remaining }: { remaining: number }) {
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [codes, setCodes] = useState<string[] | null>(null);
    const [copied, setCopied] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        const res = await regenerateBackupCodes(code).catch(() => ({ success: false, message: "Bir hata oluştu." }) as any);
        setLoading(false);
        if (res.success && res.backupCodes) {
            setCodes(res.backupCodes);
            setCode("");
        } else setError(res.message || "Bir hata oluştu.");
    };

    return (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3">
                <ShieldCheck className="w-6 h-6 text-green-600 shrink-0" />
                <div>
                    <p className="font-semibold text-gray-900 dark:text-white">İki adımlı doğrulama açık</p>
                    <p className="text-sm text-gray-500">
                        Kalan yedek kod: <b>{codes ? codes.length : remaining}</b>. Yedek kodlar telefonunuz yanınızda değilken giriş içindir; her biri bir kez kullanılır.
                    </p>
                </div>
            </div>

            {codes ? (
                <div className="space-y-3">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                        <b>Yeni yedek kodlarınız.</b> Eskilerin hepsi geçersiz oldu. Bir kâğıda yazıp saklayın; bu sayfadan çıkınca tekrar gösterilmez.
                    </p>
                    <div className="grid grid-cols-2 gap-2 font-mono text-base bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                        {codes.map((c) => (
                            <span key={c} className="text-center tracking-wider">{c}</span>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={async () => {
                            try {
                                await navigator.clipboard.writeText(codes.join("\n"));
                                setCopied(true);
                            } catch {}
                        }}
                        className="inline-flex items-center gap-1.5 text-sm text-[#17457C] hover:underline"
                    >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? "Kopyalandı" : "Kodları kopyala"}
                    </button>
                </div>
            ) : (
                <form onSubmit={submit} className="space-y-3">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                        Yeni 8 yedek kod almak için Authenticator'daki <b>&quot;Bardakcı Bike Yönetim&quot;</b> satırındaki güncel kodu girin. Eski yedek kodlar geçersiz olur.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            placeholder="000000"
                            className="h-11 sm:w-40 text-center text-lg tracking-[0.3em] font-mono"
                        />
                        <Button type="submit" disabled={loading || code.trim().length < 6} className="h-11 bg-[#17457C] hover:bg-[#0f3460] text-white">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><KeyRound className="w-4 h-4 mr-2" />Yeni yedek kodlar oluştur</>}
                        </Button>
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                </form>
            )}
        </div>
    );
}
