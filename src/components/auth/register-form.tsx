"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, Building2 } from "lucide-react";
import { registerUser } from "@/app/register/actions";
import { SearchablePicker } from "@/components/ui/searchable-picker";
import { getDistrictsOfCity, getCityNames } from "@/lib/cities";

interface RegisterFormProps {
    logoUrl?: string;
    siteName?: string;
    isMotor?: boolean;
}

export function RegisterForm({ logoUrl, siteName, isMotor = false }: RegisterFormProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl");
    const isCorporateType = searchParams.get("type") === "corporate" || searchParams.get("type") === "dealer";
    
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [isCorporate, setIsCorporate] = useState(isCorporateType);
    const [selectedCity, setSelectedCity] = useState<string>("");
    const [selectedDistrict, setSelectedDistrict] = useState<string>("");

    const handleGoogleSignIn = async () => {
        setGoogleLoading(true);
        try {
            await signIn("google", {
                callbackUrl: callbackUrl || "/account",
            });
        } catch (error) {
            console.error("GOOGLE_REGISTER_SIGNIN_ERROR:", error);
            toast.error("Google ile işlem başlatılamadı.");
            setGoogleLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const phoneRaw = String(formData.get("phone")).replace(/\D/g, "");

        if (phoneRaw.length < 10) {
            toast.error("Lütfen geçerli bir telefon numarası giriniz (Örn: 05xx...)");
            setLoading(false);
            return;
        }

        if (isCorporate) {
            const companyName = String(formData.get("companyName") || "").trim();
            const taxNumber = String(formData.get("taxNumber") || "").trim();

            if (!companyName) {
                toast.error("Kurumsal üyelik için Firma Ünvanı zorunludur.");
                setLoading(false);
                return;
            }
            if (!taxNumber) {
                toast.error("Kurumsal üyelik için Vergi Numarası zorunludur.");
                setLoading(false);
                return;
            }
        }

        try {
            const result = await registerUser(formData);

            if (result.success) {
                toast.success("Kayıt başarılı! Giriş yapılıyor...");
                const email = String(formData.get("email"));
                const password = String(formData.get("password"));
                const loginResult = await signIn("credentials", {
                    email,
                    password,
                    redirect: false,
                });
                if (loginResult?.ok) {
                    router.push(callbackUrl || "/account");
                } else {
                    router.push(callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login");
                }
            } else {
                toast.error(result.error || "Kayıt sırasında bir hata oluştu.");
            }
        } catch (error) {
            console.error("REGISTER_FORM_ERROR:", error);
            toast.error("İşlem sırasında bir hata oluştu. Lütfen tekrar deneyiniz.");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <Card className="w-full max-w-lg shadow-xl border-green-200 bg-white/95 backdrop-blur">
                <CardHeader className="text-center pb-2">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <CardTitle className="text-2xl text-green-700">Kayıt Başarılı</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-6 pt-4">
                    <div className="space-y-4 text-gray-600 dark:text-gray-300">
                        <p className="text-lg font-medium">
                            Hesabınız başarıyla oluşturuldu.
                        </p>
                        <p>
                            Şimdi giriş yaparak alışverişe başlayabilirsiniz.
                        </p>
                    </div>

                    <div className="pt-4">
                        <Link href={callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login"}>
                            <Button size="lg" className="w-full bg-[#17457C] hover:bg-[#0f3460]">
                                Giriş Yap
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-lg">
            <CardHeader className="text-center">
                <div className="w-16 h-16 bg-[#17457C] rounded-2xl flex items-center justify-center mx-auto mb-4 overflow-hidden relative shadow-md">
                    {logoUrl ? (
                        <Image
                            src={logoUrl}
                            alt={siteName || "Logo"}
                            fill
                            className="object-contain p-2 bg-white"
                        />
                    ) : (
                        <span className="text-white font-bold text-2xl">
                            {(siteName || "M").charAt(0).toUpperCase()}
                        </span>
                    )}
                </div>
                <CardTitle className="text-2xl">Üye Kaydı</CardTitle>
                <CardDescription>
                    Alışverişe başlamak için hemen üye olun.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    
                    {/* Kurumsal Üyelik Checkbox (Sadece Motor Sitesinde veya type=corporate parametresinde görünür) */}
                    {(isMotor || isCorporateType) && (
                        <div className="flex items-center space-x-3 p-3.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100/80 transition-colors">
                            <Checkbox
                                id="isCorporateCheckbox"
                                checked={isCorporate}
                                onCheckedChange={(checked) => setIsCorporate(!!checked)}
                                className="h-5 w-5 border-gray-400 data-[state=checked]:bg-[#17457C] data-[state=checked]:border-[#17457C]"
                            />
                            <Label htmlFor="isCorporateCheckbox" className="text-sm font-bold text-gray-800 dark:text-gray-200 cursor-pointer select-none">
                                Kurumsal Üyelik Yapmak İstiyorum (Bayi)
                            </Label>
                        </div>
                    )}

                    {/* Kurumsal Alanlar */}
                    {isCorporate && (
                        <div className="space-y-4 p-4 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl animate-in fade-in-50 duration-200">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-1">
                                <Building2 className="h-4 w-4 text-amber-600" />
                                Bayi / Firma Bilgileri
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="companyName">Firma Ünvanı *</Label>
                                <Input 
                                    id="companyName" 
                                    name="companyName" 
                                    type="text" 
                                    placeholder="Örn: Özkan Motor Ltd. Şti." 
                                    required={isCorporate} 
                                />
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="taxNumber">Vergi Numarası / T.C. *</Label>
                                    <Input 
                                        id="taxNumber" 
                                        name="taxNumber" 
                                        type="text" 
                                        placeholder="Vergi No veya T.C." 
                                        required={isCorporate} 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="taxOffice">Vergi Dairesi</Label>
                                    <Input 
                                        id="taxOffice" 
                                        name="taxOffice" 
                                        type="text" 
                                        placeholder="Vergi Dairesi" 
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="name">Ad Soyad *</Label>
                        <Input id="name" name="name" type="text" placeholder="Örn: Ahmet Yılmaz" required />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="email">E-posta *</Label>
                            <Input id="email" name="email" type="email" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Telefon *</Label>
                            <Input 
                                id="phone" 
                                name="phone" 
                                type="tel" 
                                required 
                                placeholder="05XX XXX XX XX"
                                maxLength={15}
                                onChange={(e) => {
                                    let val = e.target.value.replace(/\D/g, "");
                                    if (val.length > 11) val = val.substring(0, 11);
                                    
                                    let formatted = "";
                                    if (val.length > 0) {
                                        formatted = val.substring(0, 4);
                                        if (val.length > 4) formatted += " " + val.substring(4, 7);
                                        if (val.length > 7) formatted += " " + val.substring(7, 9);
                                        if (val.length > 9) formatted += " " + val.substring(9, 11);
                                    }
                                    e.target.value = formatted;
                                }}
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="password">Şifre *</Label>
                            <Input id="password" name="password" type="password" minLength={6} required autoComplete="new-password" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Şifre Tekrar *</Label>
                            <Input id="confirmPassword" name="confirmPassword" type="password" minLength={6} required autoComplete="new-password" />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 pt-2 border-t">
                        <div className="space-y-2">
                            <Label htmlFor="city">Şehir *</Label>
                            <SearchablePicker
                                options={getCityNames()}
                                value={selectedCity}
                                onValueChange={(val) => {
                                    setSelectedCity(val);
                                    setSelectedDistrict("");
                                }}
                                placeholder="Şehir seçiniz"
                                searchPlaceholder="Şehir ara..."
                                title="Şehir Seçimi"
                            />
                            <input type="hidden" name="city" value={selectedCity} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="district">İlçe *</Label>
                            <SearchablePicker
                                options={selectedCity ? getDistrictsOfCity(selectedCity) : []}
                                value={selectedDistrict}
                                onValueChange={setSelectedDistrict}
                                disabled={!selectedCity}
                                placeholder="İlçe seçiniz"
                                searchPlaceholder="İlçe ara..."
                                title="İlçe Seçimi"
                                emptyMessage={selectedCity ? "İlçe bulunamadı." : "Önce şehir seçiniz."}
                            />
                            <input type="hidden" name="district" value={selectedDistrict} required />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="address">Adres *</Label>
                        <Textarea 
                            id="address" 
                            name="address" 
                            rows={2} 
                            required 
                            minLength={10}
                            placeholder="Sokak, Mahalle, Bina No, Kat, Daire..."
                        />
                    </div>

                    <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={loading}>
                        {loading ? "Kayıt yapılıyor..." : (isCorporate ? "Bayi Kaydı Oluştur" : "Kayıt Ol")}
                    </Button>
                </form>

                {/* Google Sign In / Fast Register */}
                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200 dark:border-gray-700" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-white dark:bg-gray-800 text-gray-500">veya</span>
                    </div>
                </div>

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
                    <span>Google ile Hızlı Kayıt / Giriş</span>
                </button>

                <div className="mt-6 text-center text-sm">
                    <span className="text-gray-500">Zaten hesabınız var mı? </span>
                    <Link
                        href={callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login"}
                        className="text-[#17457C] font-semibold hover:underline"
                    >
                        Giriş Yap
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}
