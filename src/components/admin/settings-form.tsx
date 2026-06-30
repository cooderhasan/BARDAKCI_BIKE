"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { updateSiteSettings } from "@/app/admin/(protected)/settings/actions";
import { ImageUpload } from "@/components/ui/image-upload";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CargoSettings } from "@/components/admin/cargo-settings";
import { Switch } from "@/components/ui/switch";

interface CargoCompany {
    id: string;
    name: string;
    isActive: boolean;
    isDesiActive: boolean;
}

interface SettingsFormProps {
    initialSettings: Record<string, string>;
    cargoCompanies: CargoCompany[];
}

export function SettingsForm({ initialSettings, cargoCompanies }: SettingsFormProps) {
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState(initialSettings);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await updateSiteSettings("general", settings);
            toast.success("Ayarlar kaydedildi.");
        } catch {
            toast.error("Bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    const updateField = (key: string, value: string) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
    };

    if (!mounted) {
        return null;
    }

    return (
        <div className="space-y-6">
            <Tabs defaultValue="general" className="space-y-6">
                <TabsList className="bg-white dark:bg-gray-800 p-1 rounded-lg border flex flex-wrap h-auto gap-2">
                    <TabsTrigger value="general" className="px-4 py-2">Genel & İletişim</TabsTrigger>
                    <TabsTrigger value="branding" className="px-4 py-2">Marka & Görseller</TabsTrigger>
                    <TabsTrigger value="seo" className="px-4 py-2">SEO & Meta</TabsTrigger>
                    <TabsTrigger value="content" className="px-4 py-2">Sayfa İçerikleri</TabsTrigger>
                    <TabsTrigger value="payment" className="px-4 py-2">Ödeme Bilgileri</TabsTrigger>
                    <TabsTrigger value="social" className="px-4 py-2">Sosyal Medya</TabsTrigger>
                    <TabsTrigger value="scripts" className="px-4 py-2">Script & Analitik</TabsTrigger>
                    <TabsTrigger value="cargo" className="px-4 py-2">Kargo & Teslimat</TabsTrigger>
                    <TabsTrigger value="stock" className="px-4 py-2">Stok Ayarları</TabsTrigger>
                    <TabsTrigger value="xml" className="px-4 py-2">Entegrasyonlar (XML)</TabsTrigger>
                </TabsList>

                {/* Main Settings Form Wrapper */}
                <form id="main-settings-form" onSubmit={handleSubmit}>
                    <TabsContent value="general" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Genel Bilgiler</CardTitle>
                                <CardDescription>
                                    Site ve firma bilgilerini düzenleyin
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="siteName">Site Adı</Label>
                                        <Input
                                            id="siteName"
                                            value={settings.siteName || ""}
                                            onChange={(e) => updateField("siteName", e.target.value)}
                                            placeholder="B2B Toptancı"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="companyName">Firma Adı</Label>
                                        <Input
                                            id="companyName"
                                            value={settings.companyName || ""}
                                            onChange={(e) => updateField("companyName", e.target.value)}
                                            placeholder="Firma Ltd. Şti."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="taxOffice">Vergi Dairesi</Label>
                                        <Input
                                            id="taxOffice"
                                            value={settings.taxOffice || ""}
                                            onChange={(e) => updateField("taxOffice", e.target.value)}
                                            placeholder="Meram"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="taxNumber">Vergi Numarası</Label>
                                        <Input
                                            id="taxNumber"
                                            value={settings.taxNumber || ""}
                                            onChange={(e) => updateField("taxNumber", e.target.value)}
                                            placeholder="2030321343"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>İletişim Bilgileri</CardTitle>
                                <CardDescription>
                                    İletişim bilgilerini güncelleyin
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Telefon</Label>
                                        <Input
                                            id="phone"
                                            value={settings.phone || ""}
                                            onChange={(e) => updateField("phone", e.target.value)}
                                            placeholder="+90 212 555 0000"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email">E-posta</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            value={settings.email || ""}
                                            onChange={(e) => updateField("email", e.target.value)}
                                            placeholder="info@firma.com"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="whatsappNumber">WhatsApp Numarası</Label>
                                        <Input
                                            id="whatsappNumber"
                                            value={settings.whatsappNumber || ""}
                                            onChange={(e) => updateField("whatsappNumber", e.target.value)}
                                            placeholder="905551234567"
                                        />
                                        <p className="text-xs text-gray-500">
                                            Ülke kodu ile birlikte, başında + olmadan girin
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="address">Adres</Label>
                                    <Textarea
                                        id="address"
                                        value={settings.address || ""}
                                        onChange={(e) => updateField("address", e.target.value)}
                                        placeholder="İstanbul, Türkiye"
                                        rows={3}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="workingHours">Çalışma Saatleri</Label>
                                    <Input
                                        id="workingHours"
                                        value={settings.workingHours || ""}
                                        onChange={(e) => updateField("workingHours", e.target.value)}
                                        placeholder="Hafta içi ve Cumartesi: 08:00 - 20:00 Pazar: Kapalı"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="googleMapsEmbedUrl">Google Maps Embed URL</Label>
                                    <Textarea
                                        id="googleMapsEmbedUrl"
                                        value={settings.googleMapsEmbedUrl || ""}
                                        onChange={(e) => updateField("googleMapsEmbedUrl", e.target.value)}
                                        placeholder="https://www.google.com/maps/embed?..."
                                        rows={3}
                                    />
                                    <p className="text-xs text-gray-500">
                                        Google Maps'te "Paylaş &gt; Harita yerleştir" seçeneğindeki "src" özelliğinin içindeki URL'yi buraya yapıştırın.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="branding" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Marka Görselleri</CardTitle>
                                <CardDescription>Site logosu ve tarayıcı ikonu</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-8">
                                <div className="space-y-2">
                                    <Label>Site Logosu (Header)</Label>
                                    <div className="text-xs text-gray-500 mb-2">Önerilen boyut: <span className="font-bold">200x60px</span>. Format: <span className="font-bold">PNG</span> (Şeffaf arka plan önerilir).</div>
                                    <ImageUpload
                                        value={settings.logoUrl ? [settings.logoUrl] : []}
                                        onChange={(urls) => updateField("logoUrl", urls[0] || "")}
                                        onRemove={() => updateField("logoUrl", "")}
                                        maxFiles={1}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Favicon (Tarayıcı İkonu)</Label>
                                    <div className="text-xs text-gray-500 mb-2">Önerilen boyut: <span className="font-bold">32x32px</span> veya <span className="font-bold">64x64px</span>. Format: <span className="font-bold">PNG</span> veya <span className="font-bold">ICO</span>.</div>
                                    <ImageUpload
                                        value={settings.faviconUrl ? [settings.faviconUrl] : []}
                                        onChange={(urls) => updateField("faviconUrl", urls[0] || "")}
                                        onRemove={() => updateField("faviconUrl", "")}
                                        maxFiles={1}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>OpenGraph Görseli (Paylaşım Görseli)</Label>
                                    <div className="text-xs text-gray-500 mb-2">Önerilen boyut: <span className="font-bold">1200x630px</span>. Format: <span className="font-bold">JPG</span> or <span className="font-bold">PNG</span>. Sosyal medyada siteniz paylaşıldığında görünecek görseldir.</div>
                                    <ImageUpload
                                        value={settings.ogImageUrl ? [settings.ogImageUrl] : []}
                                        onChange={(urls) => updateField("ogImageUrl", urls[0] || "")}
                                        onRemove={() => updateField("ogImageUrl", "")}
                                        maxFiles={1}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="seo" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>SEO Ayarları</CardTitle>
                                <CardDescription>Arama motoru optimizasyonu için meta bilgileri</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="seoTitle">Site Başlığı (Title)</Label>
                                    <Input
                                        id="seoTitle"
                                        value={settings.seoTitle || settings.siteName || ""}
                                        onChange={(e) => updateField("seoTitle", e.target.value)}
                                        placeholder="Site adı - En iyi toptan satış sitesi"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="seoDescription">Site Açıklaması (Description)</Label>
                                    <Textarea
                                        id="seoDescription"
                                        value={settings.seoDescription || ""}
                                        onChange={(e) => updateField("seoDescription", e.target.value)}
                                        placeholder="Sitenizi tanıtan kısa bir açıklama..."
                                        rows={3}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="seoKeywords">Anahtar Kelimeler (Keywords)</Label>
                                    <Input
                                        id="seoKeywords"
                                        value={settings.seoKeywords || ""}
                                        onChange={(e) => updateField("seoKeywords", e.target.value)}
                                        placeholder="toptan, b2b, satış, e-ticaret (virgülle ayırın)"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="googleVerification">Google Search Console Doğrulama Kodu</Label>
                                    <Input
                                        id="googleVerification"
                                        value={settings.googleVerification || ""}
                                        onChange={(e) => updateField("googleVerification", e.target.value)}
                                        placeholder="google-site-verification kodunu girin (Örn: google123456789)"
                                    />
                                    <p className="text-xs text-gray-500">
                                        Google Search Console doğrulama kodu. Sadece kodun kendisini girin (meta etiketinin tamamını değil).
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="content" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Hakkımızda Sayfası İçeriği</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <input type="hidden" name="aboutContent" value={settings.aboutContent || ""} />
                                <RichTextEditor
                                    content={settings.aboutContent || ""}
                                    onChange={(value) => updateField("aboutContent", value)}
                                    placeholder="Hakkımızda sayfası içeriğini buraya girin..."
                                />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>İletişim Sayfası Ek İçeriği</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <input type="hidden" name="contactContent" value={settings.contactContent || ""} />
                                <RichTextEditor
                                    content={settings.contactContent || ""}
                                    onChange={(value) => updateField("contactContent", value)}
                                    placeholder="İletişim sayfasında görünecek ek bilgiler..."
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="payment" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Banka Hesap Bilgileri</CardTitle>
                                <CardDescription>
                                    Havale ile ödeme yapan müşterilere sipariş sonrası gösterilecek banka bilgileri
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="bankName">Banka Adı</Label>
                                        <Input
                                            id="bankName"
                                            value={settings.bankName || ""}
                                            onChange={(e) => updateField("bankName", e.target.value)}
                                            placeholder="Garanti Bankası"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="bankAccountName">Hesap Sahibi Adı</Label>
                                        <Input
                                            id="bankAccountName"
                                            value={settings.bankAccountName || ""}
                                            onChange={(e) => updateField("bankAccountName", e.target.value)}
                                            placeholder="Firma Ltd. Şti."
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="bankIban1">IBAN 1</Label>
                                    <Input
                                        id="bankIban1"
                                        value={settings.bankIban1 || ""}
                                        onChange={(e) => updateField("bankIban1", e.target.value)}
                                        placeholder="TR00 0000 0000 0000 0000 0000 00"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="bankIban2">IBAN 2 (Opsiyonel)</Label>
                                    <Input
                                        id="bankIban2"
                                        value={settings.bankIban2 || ""}
                                        onChange={(e) => updateField("bankIban2", e.target.value)}
                                        placeholder="TR00 0000 0000 0000 0000 0000 00"
                                    />
                                </div>

                                <div className="space-y-2 mt-4">
                                    <Label htmlFor="bankTransferDiscount">Havale İndirimi (%)</Label>
                                    <Input
                                        id="bankTransferDiscount"
                                        type="number"
                                        value={settings.bankTransferDiscount || "0"}
                                        onChange={(e) => updateField("bankTransferDiscount", e.target.value)}
                                        placeholder="Örn: 5"
                                        className="max-w-xs"
                                    />
                                    <p className="text-xs text-gray-500">
                                        Havale ile ödemeyi seçen müşterilere uygulanacak indirim oranı. 0 yazarsanız indirim uygulanmaz.
                                    </p>
                                </div>
                                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mt-4">
                                    <p className="text-sm text-amber-800 dark:text-amber-200">
                                        <strong>Not:</strong> Bu bilgiler sadece havale ile ödeme yapan müşterilere sipariş onay sayfasında gösterilecektir.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Footer Ödeme İkonları</CardTitle>
                                <CardDescription>
                                    Sayfanın en alt kısmında görünecek ödeme yöntemi logoları
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between border p-4 rounded-lg">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Visa</Label>
                                        <p className="text-sm text-gray-500">Visa logosunu göster</p>
                                    </div>
                                    <Switch
                                        checked={settings.showVisa === "true"}
                                        onCheckedChange={(checked) => updateField("showVisa", String(checked))}
                                    />
                                </div>
                                <div className="flex items-center justify-between border p-4 rounded-lg">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Mastercard</Label>
                                        <p className="text-sm text-gray-500">Mastercard logosunu göster</p>
                                    </div>
                                    <Switch
                                        checked={settings.showMastercard === "true"}
                                        onCheckedChange={(checked) => updateField("showMastercard", String(checked))}
                                    />
                                </div>
                                <div className="flex items-center justify-between border p-4 rounded-lg">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Troy</Label>
                                        <p className="text-sm text-gray-500">Troy logosunu göster</p>
                                    </div>
                                    <Switch
                                        checked={settings.showTroy === "true"}
                                        onCheckedChange={(checked) => updateField("showTroy", String(checked))}
                                    />
                                </div>
                                <div className="flex items-center justify-between border p-4 rounded-lg">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Havale / EFT</Label>
                                        <p className="text-sm text-gray-500">Banka havalesi ikonunu göster</p>
                                    </div>
                                    <Switch
                                        checked={settings.showBankTransfer === "true"}
                                        onCheckedChange={(checked) => updateField("showBankTransfer", String(checked))}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="social" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Sosyal Medya Hesapları</CardTitle>
                                <CardDescription>
                                    Footer alanında görünecek sosyal medya bağlantıları
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="facebook">Facebook URL</Label>
                                        <Input
                                            id="facebook"
                                            value={settings.facebookUrl || ""}
                                            onChange={(e) => updateField("facebookUrl", e.target.value)}
                                            placeholder="https://facebook.com/..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="instagram">Instagram URL</Label>
                                        <Input
                                            id="instagram"
                                            value={settings.instagramUrl || ""}
                                            onChange={(e) => updateField("instagramUrl", e.target.value)}
                                            placeholder="https://instagram.com/..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="twitter">Twitter / X URL</Label>
                                        <Input
                                            id="twitter"
                                            value={settings.twitterUrl || ""}
                                            onChange={(e) => updateField("twitterUrl", e.target.value)}
                                            placeholder="https://twitter.com/..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="linkedin">LinkedIn URL</Label>
                                        <Input
                                            id="linkedin"
                                            value={settings.linkedinUrl || ""}
                                            onChange={(e) => updateField("linkedinUrl", e.target.value)}
                                            placeholder="https://linkedin.com/in/..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="tiktok">TikTok URL</Label>
                                        <Input
                                            id="tiktok"
                                            value={settings.tiktokUrl || ""}
                                            onChange={(e) => updateField("tiktokUrl", e.target.value)}
                                            placeholder="https://tiktok.com/@..."
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="scripts" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Google Analytics & Özel Scriptler</CardTitle>
                                <CardDescription>
                                    Google Analytics, Meta Pixel vb. izleme kodlarını buraya ekleyebilirsiniz.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="googleAnalyticsId">Google Analytics ID (G-XXXXXXX)</Label>
                                    <Input
                                        id="googleAnalyticsId"
                                        value={settings.googleAnalyticsId || ""}
                                        onChange={(e) => updateField("googleAnalyticsId", e.target.value)}
                                        placeholder="G-1234567890"
                                        className="font-mono text-sm max-w-sm"
                                    />
                                    <p className="text-xs text-gray-500">GA4 ölçüm kimliği (Measurement ID). Örn: G-N23XYZ.. Sadece ID kısmını yazın.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="metaPixelId">Meta (Facebook) Pixel ID</Label>
                                    <Input
                                        id="metaPixelId"
                                        value={settings.metaPixelId || ""}
                                        onChange={(e) => updateField("metaPixelId", e.target.value)}
                                        placeholder="123456789012345"
                                        className="font-mono text-sm max-w-sm"
                                    />
                                    <p className="text-xs text-gray-500">Facebook Business Manager'dan aldığınız sadece rakamlardan oluşan Pixel ID.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="customBodyScripts">Body Script Alanı (&lt;body&gt; sonuna eklenir)</Label>
                                    <Textarea
                                        id="customBodyScripts"
                                        value={settings.customBodyScripts || ""}
                                        onChange={(e) => updateField("customBodyScripts", e.target.value)}
                                        placeholder="<!-- Body sonuna eklenecek kodlar -->"
                                        rows={4}
                                        className="font-mono text-sm"
                                    />
                                    <p className="text-xs text-gray-500">Facebook Pixel &lt;noscript&gt; etiketi veya sayfa sonunda çalışması gereken scriptler için kullanılır.</p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="stock" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Stok ve Envanter Ayarları</CardTitle>
                                <CardDescription>
                                    Ürün stok yönetimi ve kritik seviye ayarları
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="defaultCriticalStock">Varsayılan Kritik Stok Seviyesi</Label>
                                    <Input
                                        id="defaultCriticalStock"
                                        type="number"
                                        value={settings.defaultCriticalStock || "10"}
                                        onChange={(e) => updateField("defaultCriticalStock", e.target.value)}
                                        className="max-w-xs"
                                    />
                                    <p className="text-xs text-gray-500">
                                        Pazaryerlerine (Trendyol vb.) gönderilen stok miktarı hesaplanırken bu değer gerçek stoktan düşülür. 
                                        Örn: Stok 15, Kritik 10 ise pazaryerine 5 stok bildirilir. 
                                        <b>0</b> yaparsanız tüm stoklar olduğu gibi gönderilir.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="xml" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>XML Ürün Entegrasyonu</CardTitle>
                                <CardDescription>
                                    Bayiler ve pazar yerleri için XML ürün çıktısı ayarları
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-center space-x-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                                    <Switch
                                        id="xmlFeedActive"
                                        checked={settings.xmlFeedActive !== "false"}
                                        onCheckedChange={(checked) => updateField("xmlFeedActive", String(checked))}
                                    />
                                    <div className="space-y-0.5">
                                        <Label htmlFor="xmlFeedActive" className="text-base">XML Servisi Aktif</Label>
                                        <p className="text-sm text-gray-500">
                                            Kapatırsanız, anahtar doğru olsa bile XML linki çalışmaz.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="xmlApiKey">API Güvenlik Anahtarı (Secret Key)</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="xmlApiKey"
                                            value={settings.xmlApiKey || ""}
                                            onChange={(e) => updateField("xmlApiKey", e.target.value)}
                                            placeholder="Örn: a1b2c3d4e5..."
                                            className="font-mono"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                const key = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                                                updateField("xmlApiKey", key);
                                            }}
                                        >
                                            Yeni Oluştur
                                        </Button>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Bu anahtar XML linkinin güvenliğini sağlar. Değiştirirseniz eski linkler çalışmayı durdurur.
                                    </p>
                                </div>

                                {settings.xmlApiKey && (
                                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border space-y-2">
                                        <Label>XML Feed Linkiniz</Label>
                                        <div className="flex items-center gap-2">
                                            <code className="flex-1 bg-white dark:bg-black p-2 rounded border font-mono text-sm break-all">
                                                {typeof window !== 'undefined' ? `${window.location.origin}/api/xml/products?key=${settings.xmlApiKey}` : `/api/xml/products?key=${settings.xmlApiKey}`}
                                            </code>
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={() => {
                                                    const url = `${window.location.origin}/api/xml/products?key=${settings.xmlApiKey}`;
                                                    navigator.clipboard.writeText(url);
                                                    toast.success("Link kopyalandı!");
                                                }}
                                            >
                                                Kopyala
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label className="text-base">Fiyat Seçeneği</Label>
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            id="useSalePrice"
                                            checked={settings.xmlUseSalePrice === "true"}
                                            onCheckedChange={(checked) => updateField("xmlUseSalePrice", String(checked))}
                                        />
                                        <Label htmlFor="useSalePrice" className="font-normal">
                                            İndirimli satış fiyatlarını gönder (Kapalıysa liste fiyatı gönderilir)
                                        </Label>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </form>

                {/* Independent Cargo Tab - Outside of Main Form */}
                <TabsContent value="cargo" className="space-y-6">
                    <Card>
                        <CardContent className="space-y-4">
                            <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800 space-y-2">
                                <Label>Ücretsiz Kargo Limiti (TL)</Label>
                                <Input
                                    type="number"
                                    placeholder="20000"
                                    defaultValue={settings.freeShippingLimit || "20000"}
                                    onChange={(e) => updateField("freeShippingLimit", e.target.value)}
                                />
                                <p className="text-xs text-gray-500">
                                    Sepet tutarı bu limitin üzerindeyse kargo ücretsiz olur.
                                </p>
                            </div>
                            <CargoSettings initialCompanies={cargoCompanies} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Save Button for Main Settings - Associated via form attribute */}
            <div className="sticky bottom-4 flex justify-end mt-8 p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur border-t z-10 rounded-lg shadow-lg">
                <Button
                    type="submit"
                    form="main-settings-form"
                    disabled={loading}
                    size="lg"
                    className="w-full md:w-auto"
                >
                    {loading ? "Kaydediliyor..." : "Tüm Ayarları Kaydet"}
                </Button>
            </div>
        </div >
    );
}

