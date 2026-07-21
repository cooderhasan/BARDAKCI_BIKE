"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { saveStoreSettingsData } from "./actions";
import { StoreThemeSettings } from "@/lib/store-helper";
import { ImageUpload } from "@/components/ui/image-upload";

interface StoreSettingsClientProps {
  bikeSettings: StoreThemeSettings;
  motorSettings: StoreThemeSettings;
}

export function StoreSettingsClient({ bikeSettings, motorSettings }: StoreSettingsClientProps) {
  const [bikeForm, setBikeForm] = useState(bikeSettings);
  const [motorForm, setMotorForm] = useState(motorSettings);
  const [loadingBike, setLoadingBike] = useState(false);
  const [loadingMotor, setLoadingMotor] = useState(false);

  const handleSaveBike = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingBike(true);
    try {
      const res = await saveStoreSettingsData("BIKE", bikeForm);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Kaydetme hatası oluştu.");
    } finally {
      setLoadingBike(false);
    }
  };

  const handleSaveMotor = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingMotor(true);
    try {
      const res = await saveStoreSettingsData("MOTOR", motorForm);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Kaydetme hatası oluştu.");
    } finally {
      setLoadingMotor(false);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="bike" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="bike" className="font-bold flex items-center gap-2">
            🚲 Bardakcı Bisiklet Ayarları
          </TabsTrigger>
          <TabsTrigger value="motor" className="font-bold flex items-center gap-2">
            🏍️ Motovitrin Ayarları
          </TabsTrigger>
        </TabsList>

        {/* BIKE SETTINGS TAB */}
        <TabsContent value="bike">
          <Card className="border-blue-200 dark:border-blue-900">
            <CardHeader className="bg-blue-50/50 dark:bg-blue-950/20">
              <CardTitle className="text-blue-900 dark:text-blue-300">🚲 Bardakcı Bisiklet (bardakcibike.com.tr)</CardTitle>
              <CardDescription>
                Bisiklet mağazasına özel tema rengi, logo, iletişim ve SEO/Analitik ayarlarını buradan yönetin.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSaveBike} className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bikeTitle">Site Başlığı (Sekme İsimlendirmesi)</Label>
                    <Input
                      id="bikeTitle"
                      value={bikeForm.siteTitle}
                      onChange={(e) => setBikeForm({ ...bikeForm, siteTitle: e.target.value })}
                      placeholder="Bardakcı Bisiklet"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bikeSeo">SEO Site Açıklaması (Meta Description)</Label>
                    <Input
                      id="bikeSeo"
                      value={bikeForm.seoDescription || ""}
                      onChange={(e) => setBikeForm({ ...bikeForm, seoDescription: e.target.value })}
                      placeholder="Türkiye'nin lider bisiklet ve bisiklet yedek parça toptan satış platformu."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bikePhone">Telefon Numarası</Label>
                    <Input
                      id="bikePhone"
                      value={bikeForm.phone}
                      onChange={(e) => setBikeForm({ ...bikeForm, phone: e.target.value })}
                      placeholder="+90 554 014 41 42"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bikeEmail">E-Posta Adresi</Label>
                    <Input
                      id="bikeEmail"
                      value={bikeForm.email}
                      onChange={(e) => setBikeForm({ ...bikeForm, email: e.target.value })}
                      placeholder="info@bardakcibike.com.tr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bikeAddress">Adres</Label>
                    <Input
                      id="bikeAddress"
                      value={bikeForm.address}
                      onChange={(e) => setBikeForm({ ...bikeForm, address: e.target.value })}
                      placeholder="Selçuklu / Konya"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bikePrimary">Ana Tema Rengi (HEX)</Label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={bikeForm.primaryColor}
                        onChange={(e) => setBikeForm({ ...bikeForm, primaryColor: e.target.value })}
                        className="h-10 w-12 rounded cursor-pointer border"
                      />
                      <Input
                        id="bikePrimary"
                        value={bikeForm.primaryColor}
                        onChange={(e) => setBikeForm({ ...bikeForm, primaryColor: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bikeAccent">Vurgu Rengi (HEX)</Label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={bikeForm.accentColor}
                        onChange={(e) => setBikeForm({ ...bikeForm, accentColor: e.target.value })}
                        className="h-10 w-12 rounded cursor-pointer border"
                      />
                      <Input
                        id="bikeAccent"
                        value={bikeForm.accentColor}
                        onChange={(e) => setBikeForm({ ...bikeForm, accentColor: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bikeGA">Google Analytics (GA4 ID)</Label>
                    <Input
                      id="bikeGA"
                      value={bikeForm.googleAnalyticsId || ""}
                      onChange={(e) => setBikeForm({ ...bikeForm, googleAnalyticsId: e.target.value })}
                      placeholder="G-XXXXXXXXXX"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bikePixel">Meta (Facebook) Pixel ID</Label>
                    <Input
                      id="bikePixel"
                      value={bikeForm.metaPixelId || ""}
                      onChange={(e) => setBikeForm({ ...bikeForm, metaPixelId: e.target.value })}
                      placeholder="1234567890"
                    />
                  </div>
                </div>

                {/* LOGO & VISUALS */}
                <div className="grid gap-6 md:grid-cols-3 pt-4 border-t">
                  <div className="space-y-2">
                    <Label>Site Logosu (Açık Tema)</Label>
                    <ImageUpload
                      value={bikeForm.logoUrl ? [bikeForm.logoUrl] : []}
                      onChange={(urls) => setBikeForm({ ...bikeForm, logoUrl: urls[0] || "" })}
                      onRemove={() => setBikeForm({ ...bikeForm, logoUrl: "" })}
                      maxFiles={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Site Logosu (Koyu Tema)</Label>
                    <ImageUpload
                      value={bikeForm.darkLogoUrl ? [bikeForm.darkLogoUrl] : []}
                      onChange={(urls) => setBikeForm({ ...bikeForm, darkLogoUrl: urls[0] || "" })}
                      onRemove={() => setBikeForm({ ...bikeForm, darkLogoUrl: "" })}
                      maxFiles={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Favicon (Tarayıcı İkonu)</Label>
                    <ImageUpload
                      value={bikeForm.faviconUrl ? [bikeForm.faviconUrl] : []}
                      onChange={(urls) => setBikeForm({ ...bikeForm, faviconUrl: urls[0] || "" })}
                      onRemove={() => setBikeForm({ ...bikeForm, faviconUrl: "" })}
                      maxFiles={1}
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button type="submit" disabled={loadingBike} className="bg-[#17457C] hover:bg-[#0f3460] text-white">
                    {loadingBike ? "Kaydediliyor..." : "Bardakcı Bisiklet Ayarlarını Kaydet"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MOTOR SETTINGS TAB */}
        <TabsContent value="motor">
          <Card className="border-red-200 dark:border-red-900">
            <CardHeader className="bg-red-50/50 dark:bg-red-950/20">
              <CardTitle className="text-red-900 dark:text-red-300">🏍️ Motovitrin (motovitrin.com / motor subdomain)</CardTitle>
              <CardDescription>
                Motosiklet mağazasına özel tema rengi, logo, iletişim ve SEO/Analitik ayarlarını buradan yönetin.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSaveMotor} className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="motorTitle">Site Başlığı (Sekme İsimlendirmesi)</Label>
                    <Input
                      id="motorTitle"
                      value={motorForm.siteTitle}
                      onChange={(e) => setMotorForm({ ...motorForm, siteTitle: e.target.value })}
                      placeholder="Motovitrin - Motosiklet Yedek Parça"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="motorSeo">SEO Site Açıklaması (Meta Description)</Label>
                    <Input
                      id="motorSeo"
                      value={motorForm.seoDescription || ""}
                      onChange={(e) => setMotorForm({ ...motorForm, seoDescription: e.target.value })}
                      placeholder="Motovitrin ile en kaliteli motosiklet yedek parça ve aksesuarlarına uygun fiyatlarla ulaşın."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="motorPhone">Telefon Numarası</Label>
                    <Input
                      id="motorPhone"
                      value={motorForm.phone}
                      onChange={(e) => setMotorForm({ ...motorForm, phone: e.target.value })}
                      placeholder="+90 554 014 41 42"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="motorEmail">E-Posta Adresi</Label>
                    <Input
                      id="motorEmail"
                      value={motorForm.email}
                      onChange={(e) => setMotorForm({ ...motorForm, email: e.target.value })}
                      placeholder="info@motovitrin.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="motorAddress">Adres</Label>
                    <Input
                      id="motorAddress"
                      value={motorForm.address}
                      onChange={(e) => setMotorForm({ ...motorForm, address: e.target.value })}
                      placeholder="Selçuklu / Konya"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="motorPrimary">Ana Tema Rengi (HEX)</Label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={motorForm.primaryColor}
                        onChange={(e) => setMotorForm({ ...motorForm, primaryColor: e.target.value })}
                        className="h-10 w-12 rounded cursor-pointer border"
                      />
                      <Input
                        id="motorPrimary"
                        value={motorForm.primaryColor}
                        onChange={(e) => setMotorForm({ ...motorForm, primaryColor: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="motorAccent">Vurgu Rengi (HEX)</Label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={motorForm.accentColor}
                        onChange={(e) => setMotorForm({ ...motorForm, accentColor: e.target.value })}
                        className="h-10 w-12 rounded cursor-pointer border"
                      />
                      <Input
                        id="motorAccent"
                        value={motorForm.accentColor}
                        onChange={(e) => setMotorForm({ ...motorForm, accentColor: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="motorGA">Google Analytics (GA4 ID)</Label>
                    <Input
                      id="motorGA"
                      value={motorForm.googleAnalyticsId || ""}
                      onChange={(e) => setMotorForm({ ...motorForm, googleAnalyticsId: e.target.value })}
                      placeholder="G-XXXXXXXXXX"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="motorPixel">Meta (Facebook) Pixel ID</Label>
                    <Input
                      id="motorPixel"
                      value={motorForm.metaPixelId || ""}
                      onChange={(e) => setMotorForm({ ...motorForm, metaPixelId: e.target.value })}
                      placeholder="1234567890"
                    />
                  </div>
                </div>

                {/* LOGO & VISUALS */}
                <div className="grid gap-6 md:grid-cols-3 pt-4 border-t">
                  <div className="space-y-2">
                    <Label>Motovitrin Logosu (Açık Tema)</Label>
                    <ImageUpload
                      value={motorForm.logoUrl ? [motorForm.logoUrl] : []}
                      onChange={(urls) => setMotorForm({ ...motorForm, logoUrl: urls[0] || "" })}
                      onRemove={() => setMotorForm({ ...motorForm, logoUrl: "" })}
                      maxFiles={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Motovitrin Logosu (Koyu Tema)</Label>
                    <ImageUpload
                      value={motorForm.darkLogoUrl ? [motorForm.darkLogoUrl] : []}
                      onChange={(urls) => setMotorForm({ ...motorForm, darkLogoUrl: urls[0] || "" })}
                      onRemove={() => setMotorForm({ ...motorForm, darkLogoUrl: "" })}
                      maxFiles={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Favicon (Tarayıcı İkonu)</Label>
                    <ImageUpload
                      value={motorForm.faviconUrl ? [motorForm.faviconUrl] : []}
                      onChange={(urls) => setMotorForm({ ...motorForm, faviconUrl: urls[0] || "" })}
                      onRemove={() => setMotorForm({ ...motorForm, faviconUrl: "" })}
                      maxFiles={1}
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button type="submit" disabled={loadingMotor} className="bg-red-600 hover:bg-red-700 text-white">
                    {loadingMotor ? "Kaydediliyor..." : "Motovitrin Ayarlarını Kaydet"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
