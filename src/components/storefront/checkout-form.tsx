"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/stores/cart-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatPrice, calculatePrice, SHIPPING_FREE_LIMIT } from "@/lib/helpers";
import { createOrder } from "@/app/(storefront)/checkout/actions";
import { toast } from "sonner";
import { CreditCard, Building2, ArrowLeft, Truck } from "lucide-react";
import Link from "next/link";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { getCities, getDistrictsOfCity, getCityNames } from "@/lib/cities";
import { SearchablePicker } from "@/components/ui/searchable-picker";

interface CheckoutFormProps {
    initialData?: {
        name?: string;
        phone?: string;
        city?: string;
        district?: string;
        address?: string;
        currentAccount?: {
            creditLimit: number;
            currentDebt: number;
            availableLimit: number;
        };
    };
    cargoCompanies: {
        id: string;
        name: string;
        isDesiActive: boolean;
        desiPrices: {
            minDesi: any;
            maxDesi: any;
            price: any;
            multiplierType: string;
        }[];
    }[];
    freeShippingLimit: number;
}

export function CheckoutForm({ initialData, cargoCompanies, freeShippingLimit }: CheckoutFormProps) {
    // ...
    const router = useRouter();
    const { items, getSummary, discountRate, clearCart } = useCartStore();
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedCargoId, setSelectedCargoId] = useState<string | null>(cargoCompanies[0]?.id || null);
    const [paymentMethod, setPaymentMethod] = useState<"BANK_TRANSFER" | "CREDIT_CARD" | "CURRENT_ACCOUNT">("BANK_TRANSFER");
    const [selectedCity, setSelectedCity] = useState<string>(initialData?.city || "");
    const [selectedDistrict, setSelectedDistrict] = useState<string>(initialData?.district || "");
    const cities = getCities();
    const orderCompleted = useRef(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        // Don't redirect if order was just completed
        if (mounted && items.length === 0 && !orderCompleted.current) {
            router.push("/cart");
        }
    }, [mounted, items.length, router]);

    if (!mounted) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="text-center py-16">Yükleniyor...</div>
            </div>
        );
    }

    const summary = getSummary();

    // Calculate shipping cost
    const selectedCargo = cargoCompanies.find(c => c.id === selectedCargoId);
    let shippingCost = 0;
    const isFreeShipping = summary.total >= freeShippingLimit;

    if (!isFreeShipping && selectedCargo && selectedCargo.isDesiActive && selectedCargo.desiPrices.length > 0) {
        // Desi 0 ise en az 1 desi üzerinden hesapla (minimum kargo ücreti için)
        const totalDesi = Math.max(1, summary.totalDesi || 0);
        const range = selectedCargo.desiPrices.find(r =>
            totalDesi >= Number(r.minDesi) && totalDesi <= Number(r.maxDesi)
        ) || selectedCargo.desiPrices[selectedCargo.desiPrices.length - 1]; // Fallback to last range if exceeds max

        if (range) {
            const rangePrice = Number(range.price);
            if (range.multiplierType === "MULTIPLY") {
                shippingCost = rangePrice * Math.ceil(totalDesi);
            } else {
                shippingCost = rangePrice;
            }
        }
    }

    const grandTotal = summary.total + shippingCost;
    const canUseCurrentAccount = initialData?.currentAccount && initialData.currentAccount.availableLimit >= grandTotal;

    if (items.length === 0) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="text-center py-16">Yönlendiriliyor...</div>
            </div>
        );
    }

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

        try {
            const result = await createOrder({
                items: items.map((item) => ({
                    productId: item.productId,
                    quantity: Number(item.quantity),
                    listPrice: Number(item.listPrice),
                    vatRate: Number(item.vatRate),
                    variantId: item.variantId || undefined,
                    variantInfo: item.variantInfo || undefined,
                })),
                shippingAddress: {
                    name: String(formData.get("name")),
                    address: String(formData.get("address")),
                    city: String(formData.get("city")),
                    district: formData.get("district") ? String(formData.get("district")) : undefined,
                    phone: String(formData.get("phone")),
                },
                cargoCompany: selectedCargo?.name || String(formData.get("cargoCompany")),
                notes: formData.get("notes") ? String(formData.get("notes")) : undefined,
                paymentMethod: paymentMethod,
                guestEmail: !initialData?.name ? String(formData.get("email")) : undefined,
                discountRate: Number(discountRate),
                shippingCost: shippingCost,
                shippingDesi: summary.totalDesi,
            });

            if (result.success) {
                // Mark order as completed to prevent empty cart redirect
                orderCompleted.current = true;

                if (paymentMethod === "CREDIT_CARD") {
                    router.push(`/payment/paytr/${result.orderId}`);
                    // Note: Cart is not cleared yet, it will be cleared after successful payment notification
                } else {
                    toast.success("Siparişiniz başarıyla oluşturuldu!");
                    clearCart();
                    router.push(`/orders/${result.orderId}`);
                }
            } else {
                toast.error(result.error || "Bir hata oluştu.");
            }
        } catch (error) {
            console.error("Checkout handleSubmit error:", error);
            toast.error("Bir hata oluştu. Lütfen konsolu kontrol edin.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <Link
                href="/cart"
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6"
            >
                <ArrowLeft className="h-4 w-4" />
                Sepete Dön
            </Link>

            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
                Sipariş Tamamla
            </h1>

            <form onSubmit={handleSubmit}>
                <div className="grid gap-8 lg:grid-cols-12">
                    {/* Left Column: Forms */}
                    <div className="lg:col-span-8 space-y-6">
                        {/* Shipping Address */}
                        <Card className="border-l-4 border-l-blue-600">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Truck className="h-5 w-5 text-blue-600" />
                                    Teslimat ve Kargo
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Ad Soyad / Firma *</Label>
                                        <Input
                                            id="name"
                                            name="name"
                                            required
                                            defaultValue={initialData?.name}
                                            placeholder="Adınız veya Firma Adı"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Telefon *</Label>
                                        <Input
                                            id="phone"
                                            name="phone"
                                            type="tel"
                                            required
                                            defaultValue={initialData?.phone}
                                            placeholder="05XX XXX XX XX"
                                            maxLength={15}
                                            onChange={(e) => {
                                                let val = e.target.value.replace(/\D/g, ""); // Sadece rakamlar
                                                if (val.length > 11) val = val.substring(0, 11);
                                                
                                                // Format: 05XX XXX XX XX
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
                                    {!initialData?.name && (
                                        <div className="space-y-2">
                                            <Label htmlFor="email">E-posta Adresi * (Sipariş Takibi İçin)</Label>
                                            <Input
                                                id="email"
                                                name="email"
                                                type="email"
                                                required
                                                placeholder="ornek@mail.com"
                                            />
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <Label htmlFor="idNumber">TC Kimlik / Vergi No (Opsiyonel)</Label>
                                        <Input
                                            id="idNumber"
                                            name="idNumber"
                                            placeholder="Fatura için gereklidir"
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
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
                                        defaultValue={initialData?.address}
                                        placeholder="Tam adresiniz..."
                                    />
                                </div>

                                <Separator />

                                <div className="space-y-2">
                                    <Label htmlFor="cargoCompany">Kargo Firması Seçimi *</Label>
                                    <Select
                                        name="cargoCompany"
                                        required
                                        value={selectedCargoId || ""}
                                        onValueChange={setSelectedCargoId}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Kargo firması seçiniz" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {cargoCompanies.map((company) => (
                                                <SelectItem key={company.id} value={company.id}>
                                                    {company.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-gray-500">
                                        Siparişiniz seçtiğiniz kargo firması ile gönderilecektir.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Payment Method */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CreditCard className="h-5 w-5" />
                                    Ödeme Yöntemi
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div
                                    className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-all ${paymentMethod === "CREDIT_CARD" ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 ring-2 ring-blue-500 ring-offset-2" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                                    onClick={() => setPaymentMethod("CREDIT_CARD")}
                                >
                                    <CreditCard className={`h-6 w-6 mt-1 ${paymentMethod === "CREDIT_CARD" ? "text-blue-600" : "text-gray-500"}`} />
                                    <div className="flex-1">
                                        <div className="flex justify-between">
                                            <p className={`font-medium ${paymentMethod === "CREDIT_CARD" ? "text-blue-700 dark:text-blue-400" : "text-gray-900 dark:text-white"}`}>
                                                Kredi Kartı / Banka Kartı
                                            </p>
                                        </div>
                                        <p className="text-sm text-gray-500 mt-1">
                                            PayTR güvencesiyle 12 aya varan taksit seçenekleri.
                                        </p>
                                    </div>
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${paymentMethod === "CREDIT_CARD" ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300"}`}>
                                        {paymentMethod === "CREDIT_CARD" && <div className="w-2 h-2 rounded-full bg-white" />}
                                    </div>
                                </div>

                                <div
                                    className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-all ${paymentMethod === "BANK_TRANSFER" ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 ring-2 ring-blue-500 ring-offset-2" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                                    onClick={() => setPaymentMethod("BANK_TRANSFER")}
                                >
                                    <Building2 className={`h-6 w-6 mt-1 ${paymentMethod === "BANK_TRANSFER" ? "text-blue-600" : "text-gray-500"}`} />
                                    <div className="flex-1">
                                        <div className="flex justify-between">
                                            <p className={`font-medium ${paymentMethod === "BANK_TRANSFER" ? "text-blue-700 dark:text-blue-400" : "text-gray-900 dark:text-white"}`}>
                                                Havale / EFT
                                            </p>
                                        </div>
                                        <p className="text-sm text-gray-500 mt-1">
                                            Banka hesap bilgilerimize havale yaparak ödeme yapabilirsiniz.
                                        </p>
                                    </div>
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${paymentMethod === "BANK_TRANSFER" ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300"}`}>
                                        {paymentMethod === "BANK_TRANSFER" && <div className="w-2 h-2 rounded-full bg-white" />}
                                    </div>
                                </div>

                                {false && (
                                    <div className="flex items-start gap-4 p-4 border rounded-lg opacity-60 cursor-not-allowed bg-gray-50 dark:bg-gray-800/50">
                                        <Truck className="h-6 w-6 mt-1 text-gray-400" />
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center">
                                                <p className="font-medium text-gray-500">
                                                    Kapıda Ödeme
                                                </p>
                                                <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                                                    Yakında
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-400 mt-1">
                                                Bu ödeme yöntemi şu anda aktif değildir.
                                            </p>
                                        </div>
                                        <div className="w-5 h-5 rounded-full border border-gray-300"></div>
                                    </div>
                                )}

                                {false && initialData?.currentAccount && (
                                    <div
                                        className={`flex items-start gap-4 p-4 border rounded-lg transition-all ${!canUseCurrentAccount ? "opacity-60 cursor-not-allowed bg-gray-50" :
                                            paymentMethod === "CURRENT_ACCOUNT" ? "bg-orange-50 dark:bg-orange-900/20 border-orange-200 ring-2 ring-orange-500 ring-offset-2 cursor-pointer" : "hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                                            }`}
                                        onClick={() => canUseCurrentAccount && setPaymentMethod("CURRENT_ACCOUNT")}
                                    >
                                        <CreditCard className={`h-6 w-6 mt-1 ${paymentMethod === "CURRENT_ACCOUNT" ? "text-orange-600" : "text-gray-500"}`} />
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center">
                                                <p className={`font-medium ${paymentMethod === "CURRENT_ACCOUNT" ? "text-orange-700 dark:text-orange-400" : "text-gray-900 dark:text-white"}`}>
                                                    Cari Hesap (Açık Hesap)
                                                </p>
                                                <span className={`text-xs px-2 py-1 rounded font-medium ${canUseCurrentAccount ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                                    {canUseCurrentAccount ? "Limit Uygun" : "Limit Yetersiz"}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-500 mt-1">
                                                Bakiyenizden düşülerek anında sipariş oluşturulur.
                                            </p>
                                            <div className="mt-3 text-sm grid grid-cols-2 gap-2 bg-white dark:bg-gray-900 p-2 rounded border border-gray-100 dark:border-gray-800">
                                                <div className="text-gray-500">Kullanılabilir Limit:</div>
                                                <div className="text-right font-medium text-gray-900 dark:text-white">{formatPrice(initialData?.currentAccount?.availableLimit || 0)}</div>
                                                <div className="text-gray-500">Kredi Limiti:</div>
                                                <div className="text-right text-gray-500">{formatPrice(initialData?.currentAccount?.creditLimit || 0)}</div>
                                            </div>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${paymentMethod === "CURRENT_ACCOUNT" ? "border-orange-600 bg-orange-600 text-white" : "border-gray-300"}`}>
                                            {paymentMethod === "CURRENT_ACCOUNT" && <div className="w-2 h-2 rounded-full bg-white" />}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Sipariş Notu</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Textarea
                                    name="notes"
                                    placeholder="Siparişinizle ilgili belirtmek istediğiniz özel bir durum var mı?"
                                    rows={2}
                                />
                            </CardContent>
                        </Card>
                    </div>

                    <div className="lg:col-span-4">
                        <Card className="sticky top-24 shadow-lg border-t-4 border-t-gray-800 dark:border-t-gray-200">
                            <CardHeader className="pb-4">
                                <CardTitle>Sipariş Özeti</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="max-h-80 overflow-y-auto space-y-4 p-2 pt-4 scrollbar-thin scrollbar-thumb-gray-200">
                                    {items.map((item) => (
                                        <div
                                            key={item.variantId ? `${item.productId}-${item.variantId}` : item.productId}
                                            className="flex gap-4 items-center group relative"
                                        >
                                            <div className="relative shrink-0">
                                                <div className="h-16 w-16 border bg-white rounded-md overflow-hidden">
                                                    {item.image ? (
                                                        <Image
                                                            src={item.image}
                                                            alt={item.name}
                                                            fill
                                                            className="object-contain p-1"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                                                            Resim Yok
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full shadow-md z-10 border border-white">
                                                    {item.quantity}
                                                </span>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 leading-tight" title={item.name}>
                                                    {item.name}
                                                </p>
                                                {item.variantInfo && (
                                                    <p className="text-xs text-gray-500 mt-1">{item.variantInfo}</p>
                                                )}
                                                <div className="mt-1 font-semibold text-gray-900 dark:text-white text-sm">
                                                    {formatPrice(
                                                        calculatePrice(
                                                            item.listPrice,
                                                            item.salePrice || undefined,
                                                            item.discountRate !== undefined ? item.discountRate : discountRate,
                                                            item.vatRate
                                                        ).finalPrice * item.quantity
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <Separator />

                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                                        <span>Ara Toplam</span>
                                        <span>{formatPrice(summary.subtotal)}</span>
                                    </div>
                                    {summary.discountAmount > 0 && (
                                        <div className="flex justify-between text-green-600 font-medium">
                                            <span>İskonto ({Math.round((summary.discountAmount / (summary.total + summary.discountAmount)) * 100)}%)</span>
                                            <span>-{formatPrice(summary.discountAmount)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                                        <span>KDV Toplam</span>
                                        <span>{formatPrice(summary.vatAmount)}</span>
                                    </div>
                                    <div className="flex justify-between items-center font-medium">
                                        <span className="text-gray-600 dark:text-gray-400">Kargo</span>
                                        {isFreeShipping ? (
                                            <span className="text-green-600">Ücretsiz</span>
                                        ) : selectedCargo && !selectedCargo.isDesiActive ? (
                                            <span className="text-gray-900 dark:text-gray-200 uppercase text-xs font-bold">
                                                Alıcı Ödemeli
                                            </span>
                                        ) : (
                                            <span className="text-gray-900 dark:text-gray-200">
                                                {formatPrice(shippingCost)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <Separator />

                                <div className="flex justify-between items-end">
                                    <span className="font-bold text-lg">Toplam Tutar</span>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-blue-600">
                                            {formatPrice(grandTotal)}
                                        </div>

                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        "Sipariş Oluşturuluyor..."
                                    ) : (
                                        <>
                                            Siparişi Onayla
                                            <span className="ml-2 font-normal text-blue-100/80">
                                                • {formatPrice(grandTotal)}
                                            </span>
                                        </>
                                    )}
                                </Button>

                                <div className="text-[10px] text-center text-gray-400 leading-tight">
                                    <p>Siparişi onaylayarak <Link href="/policies/distance-sales" className="underline hover:text-gray-600">Mesafeli Satış Sözleşmesi</Link>'ni</p>
                                    <p>kabul etmiş olursunuz.</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </form>
        </div>
    );
}
