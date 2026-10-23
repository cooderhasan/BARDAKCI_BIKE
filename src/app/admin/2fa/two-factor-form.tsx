"use client";

import { useState } from "react";
import { ShieldCheck, Loader2, Smartphone, KeyRound, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmTwoFactorSetup, finishTwoFactorSetup, verifyTwoFactorLogin, signOutFromTwoFactor } from "./actions";

interface Props {
    mode: "setup" | "verify";
    email: string;
    qrDataUrl?: string;
    secret?: string;
}

export function TwoFactorForm({ mode, email, qrDataUrl, secret }: Props) {
    const [code, setCode] = useState("");
    const [useBackup, setUseBackup] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
    const [setupToken, setSetupToken] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Tam sayfa geçiş: oturum yeniden okunur ve yönetici yetkisi gelir
    const goPanel = () => {
        window.location.href = "/admin";
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (mode === "setup") {
                const res = await confirmTwoFactorSetup(code);
                if (res.success && res.backupCodes) {
                    setBackupCodes(res.backupCodes);
                    setSetupToken(res.setupToken || null);
                }
                else setError(res.message || "Doğrulanamadı.");
            } else {
                const res = await verifyTwoFactorLogin(code, useBackup);
                if (res.success) goPanel();
                else setError(res.message || "Doğrulanamadı.");
            }
        } catch {
            setError("Bir hata oluştu, tekrar deneyin.");
        } finally {
            setLoading(false);
        }
    };

    // Yedek kodlar gösterildi: doğrulama çerezi şimdi alınır, sonra panele
    const finishSetup = async () => {
        setLoading(true);
        const res = await finishTwoFactorSetup(setupToken || "").catch(() => ({ success: false, message: "Bir hata oluştu." }));
        if (res.success) goPanel();
        else {
            setLoading(false);
            setError(res.message || "Bir hata oluştu.");
        }
    };

    const copyCodes = async () => {
        if (!backupCodes) return;
        try {
            await navigator.clipboard.writeText(backupCodes.join("\n"));
            setCopied(true);
        } catch {}
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 px-4 py-8">
            <div className="max-w-md w-full bg-gray-800/95 border border-gray-700/50 rounded-3xl shadow-2xl p-6 sm:p-8 text-gray-100">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
                        <ShieldCheck className="h-8 w-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">İki Adımlı Doğrulama</h1>
                    <p className="text-gray-400 text-sm mt-1 break-all">{email}</p>
                </div>

                {backupCodes ? (
                    // Kurulum bitti: yedek kodlar yalnızca bu ekranda bir kez gösterilir
                    <div className="space-y-4">
                        <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-3 text-sm text-green-300">
                            İki adımlı doğrulama açıldı.
                        </div>
                        <div>
                            <p className="text-sm text-gray-300 mb-2">
                                <b>Yedek kodlarınız.</b> Telefonunuz yanınızda değilken ya da kaybolursa bunlarla girersiniz. Her kod bir kez
                                kullanılır. <b>Bir kâğıda yazıp saklayın</b>; bu ekran kapanınca tekrar gösterilmez.
                            </p>
                            <div className="grid grid-cols-2 gap-2 font-mono text-base bg-gray-900/70 rounded-xl p-4 border border-gray-700">
                                {backupCodes.map((c) => (
                                    <span key={c} className="text-center tracking-wider">{c}</span>
                                ))}
                            </div>
                            <button type="button" onClick={copyCodes} className="mt-2 inline-flex items-center gap-1.5 text-xs text-blue-300 hover:text-blue-200">
                                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                {copied ? "Kopyalandı" : "Kodları kopyala"}
                            </button>
                        </div>
                        {error && <p className="text-sm text-red-400 text-center">{error}</p>}
                        <Button onClick={finishSetup} disabled={loading} className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl">
                            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Kodları sakladım, panele geç"}
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-5">
                        {mode === "setup" ? (
                            <div className="space-y-3 text-sm text-gray-300">
                                <p className="flex gap-2">
                                    <Smartphone className="w-4 h-4 mt-0.5 shrink-0 text-blue-300" />
                                    <span>
                                        Telefonunuzdaki <b>Google Authenticator</b> uygulamasında <b>+</b> → <b>QR kodu tara</b> deyip aşağıdaki kodu
                                        okutun. Ardından uygulamada <b>&quot;Bardakcı Bike Yönetim&quot;</b> satırındaki 6 haneli kodu girin.
                                    </span>
                                </p>
                                {qrDataUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={qrDataUrl} alt="Kurulum QR kodu" className="mx-auto rounded-xl bg-white p-2 w-[220px] h-[220px]" />
                                )}
                                {secret && (
                                    <p className="text-xs text-gray-400 text-center">
                                        QR okutulamıyorsa uygulamada &quot;Kurulum anahtarı gir&quot; deyip şunu yazın:
                                        <span className="block font-mono text-sm text-gray-200 mt-1 select-all break-all">{secret}</span>
                                    </p>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-300 text-center">
                                {useBackup
                                    ? "Kurulumda verilen yedek kodlardan birini girin."
                                    : "Google Authenticator'daki \"Bardakcı Bike Yönetim\" satırındaki 6 haneli kodu girin."}
                            </p>
                        )}

                        <Input
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            inputMode={useBackup ? "text" : "numeric"}
                            autoComplete="one-time-code"
                            autoFocus
                            maxLength={useBackup ? 12 : 6}
                            placeholder={useBackup ? "xxxx-xxxx" : "000000"}
                            className="h-14 text-center text-2xl tracking-[0.4em] font-mono bg-gray-900/60 border-gray-600 text-white"
                        />

                        {error && <p className="text-sm text-red-400 text-center">{error}</p>}

                        <Button type="submit" disabled={loading || code.trim().length < 6} className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl">
                            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><KeyRound className="h-5 w-5 mr-2" />{mode === "setup" ? "Doğrula ve Aç" : "Doğrula"}</>}
                        </Button>

                        <div className="flex items-center justify-between text-xs">
                            {mode === "verify" ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setUseBackup(!useBackup);
                                        setCode("");
                                        setError(null);
                                    }}
                                    className="text-blue-300 hover:text-blue-200"
                                >
                                    {useBackup ? "Uygulamadaki kodu kullan" : "Telefonum yanımda değil (yedek kod)"}
                                </button>
                            ) : (
                                <span />
                            )}
                            <button type="button" onClick={() => signOutFromTwoFactor()} className="text-gray-400 hover:text-gray-200">
                                Çıkış yap
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
