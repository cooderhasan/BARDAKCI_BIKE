"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { saveYurticiConfig, syncAllYKOrders } from "@/app/admin/(protected)/orders/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, ShieldAlert, Save, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

const formSchema = z.object({
    username: z.string().min(2, "Kullanıcı adı en az 2 karakter olmalıdır"),
    password: z.string().min(2, "Şifre en az 2 karakter olmalıdır"),
    customerCode: z.string().optional(),
    unitCode: z.string().optional(),
    demandNo: z.string().optional(),
    isTestMode: z.boolean(),
    isActive: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface YurticiKargoSettingsFormProps {
    config: any;
}

function Badge({ children, className, variant = "default" }: { children: React.ReactNode, className?: string, variant?: "default" | "outline" | "secondary" }) {
    const variants = {
        default: "bg-primary text-primary-foreground",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    }
    
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${variants[variant]} ${className}`}>
            {children}
        </span>
    )
}

export function YurticiKargoSettingsForm({ config }: YurticiKargoSettingsFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<{ count: number, delivered: number, message: string } | null>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            username: config?.username || "",
            password: config?.password || "",
            customerCode: config?.customerCode || "",
            unitCode: config?.unitCode || "",
            demandNo: config?.demandNo || "",
            isTestMode: config?.isTestMode ?? true,
            isActive: config?.isActive ?? false,
        },
    });

    async function onSubmit(values: FormValues) {
        setIsLoading(true);
        try {
            const result = await saveYurticiConfig(values);
            if (result.success) {
                toast.success("Ayarlar başarıyla kaydedildi.");
            } else {
                toast.error(result.error || "Ayarlar kaydedilemedi.");
            }
        } catch (error) {
            toast.error("Bir hata oluştu.");
        } finally {
            setIsLoading(false);
        }
    }

    async function onSync() {
        setIsSyncing(true);
        setSyncResult(null);
        try {
            const result = await syncAllYKOrders();
            if (result.success) {
                toast.success(result.message);
                setSyncResult({ 
                    count: result.count || 0, 
                    delivered: result.delivered || 0, 
                    message: result.message || "" 
                });
            } else {
                toast.error(result.error || "Senkronizasyon hatası");
            }
        } catch (error) {
            toast.error("İşlem sırasında bir hata oluştu.");
        } finally {
            setIsSyncing(false);
        }
    }

    const isTestMode = form.watch("isTestMode");

    return (
        <div className="space-y-6">
            {/* Toplu Senkronizasyon Kartı */}
            <Card className="border-blue-100 dark:border-blue-900 shadow-sm bg-blue-50/30 dark:bg-blue-900/5">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <RefreshCw className={`h-5 w-5 text-[#17457C] ${isSyncing ? "animate-spin" : ""}`} />
                        Hızlı Senkronizasyon
                    </CardTitle>
                    <CardDescription>
                        Yolda olan tüm Yurtiçi Kargo gönderilerinin durumunu tek tıkla güncelleyin.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button 
                        variant="outline" 
                        type="button"
                        className="w-full border-blue-200 text-blue-700 hover:bg-blue-50 bg-white"
                        onClick={onSync}
                        disabled={isSyncing}
                    >
                        {isSyncing ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        {isSyncing ? "Taranıyor..." : "Aktif Kargoları Şimdi Güncelle"}
                    </Button>

                    {syncResult && (
                        <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50 p-3 rounded-md border border-green-100 animate-in fade-in slide-in-from-top-1 duration-300">
                            <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-semibold">{syncResult.message}</p>
                                <p className="text-xs text-green-600">Sipariş durumları ve kargo takip linkleri güncellendi.</p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="border-orange-100 dark:border-orange-900 shadow-md">
                <CardHeader className="bg-orange-50/50 dark:bg-orange-900/10 border-b border-orange-100 dark:border-orange-900">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Save className="h-5 w-5 text-orange-600" />
                        API Bağlantı Ayarları
                    </CardTitle>
                    <CardDescription>
                        Yurtiçi Kargo tarafından size iletilen web servis bilgilerini girin.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="username"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Kullanıcı Adı</FormLabel>
                                            <FormControl>
                                                <Input placeholder="YK..." {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Şifre</FormLabel>
                                            <FormControl>
                                                <Input type="password" placeholder="••••••••" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-800/30 p-4 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 space-y-4">
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 text-orange-500" />
                                    Referans Kodları (Opsiyonel)
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="customerCode"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Müşteri Kodu</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="558..." className="h-8 text-sm" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="unitCode"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Birim Kodu</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="7065" className="h-8 text-sm" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="demandNo"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Talep No</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="780..." className="h-8 text-sm" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <p className="text-[10px] text-gray-500 italic">
                                    * Bu alanlar Yurtiçi Kargo tarafından size iletilen maildeki bilgilere göre doldurulmalıdır.
                                </p>
                            </div>

                            <div className="space-y-4 pt-2">
                                <FormField
                                    control={form.control}
                                    name="isTestMode"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-gray-50 dark:bg-gray-800/50">
                                            <div className="space-y-0.5">
                                                <div className="flex items-center gap-2">
                                                    <FormLabel className="text-base cursor-pointer">Test Modu</FormLabel>
                                                    {field.value ? (
                                                        <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">Test Aktif</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">Canlı Ortam</Badge>
                                                    )}
                                                </div>
                                                <FormDescription>
                                                    Açık olduğunda işlemler Yurtiçi Kargo test sunucularına iletilir.
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="isActive"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-gray-50 dark:bg-gray-800/50">
                                            <div className="space-y-0.5">
                                                <div className="flex items-center gap-2">
                                                    <FormLabel className="text-base cursor-pointer">Entegrasyon Durumu</FormLabel>
                                                    {field.value ? (
                                                        <Badge className="bg-green-600">Aktif</Badge>
                                                    ) : (
                                                        <Badge variant="secondary">Pasif</Badge>
                                                    )}
                                                </div>
                                                <FormDescription>
                                                    Sipariş detayında Yurtiçi Kargo panelinin görüntülenmesini sağlar.
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {isTestMode ? (
                                <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-100 dark:border-blue-900">
                                    <ShieldCheck className="h-4 w-4" />
                                    <span>Güvenli: Test modunda girdiğiniz bilgiler yalnızca test ortamı için geçerlidir.</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 p-3 rounded-md border border-red-100 dark:border-red-900 font-medium">
                                    <ShieldAlert className="h-4 w-4" />
                                    <span>Dikkat: Canlı mod aktif! İşlemler gerçek Yurtiçi Kargo sistemine iletilecektir.</span>
                                </div>
                            )}

                            <Button 
                                type="submit" 
                                className="w-full bg-orange-600 hover:bg-orange-700 text-white" 
                                disabled={isLoading}
                            >
                                {isLoading ? "Kaydediliyor..." : "Ayarları Kaydet"}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
