"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Send, AlertCircle, Plus, Trash2, Tag } from "lucide-react";
import { getCiceksepetiCategoryAttributes, syncProductsToCiceksepeti } from "@/app/admin/(protected)/integrations/ciceksepeti/actions";
import { toast } from "sonner";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  product: any;
  onSuccess: () => void;
}

export function CiceksepetiProductAttributeModal({
  isOpen,
  onClose,
  product,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiAttributes, setApiAttributes] = useState<any[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<string, { attributeValueId?: string; customValue?: string }>>({});
  
  // Teslimat Ayarları
  const [deliveryType, setDeliveryType] = useState<string>("1");
  const [deliveryDays, setDeliveryDays] = useState<string>("1");

  // Sık Kullanılan Nitelikler
  const [brandName, setBrandName] = useState<string>("");
  const [colorName, setColorName] = useState<string>("");
  const [sizeName, setSizeName] = useState<string>("");
  const [materialName, setMaterialName] = useState<string>("");
  const [genderName, setGenderName] = useState<string>("");

  // Dinamik Eklenen Özel Nitelikler
  const [customFields, setCustomFields] = useState<{ id: string; name: string; value: string }[]>([]);

  const categoryId =
    product?.ciceksepetiProduct?.ciceksepetiCategoryId ||
    product?.category?.ciceksepetiCategoryId ||
    product?.categories?.[0]?.ciceksepetiCategoryId ||
    "";

  useEffect(() => {
    if (isOpen) {
      setAttributeValues({});
      if (product?.brand?.name) {
        setBrandName(product.brand.name);
      } else {
        setBrandName("");
      }
      setColorName("");
      setSizeName("");
      setMaterialName("");
      setGenderName("");
      setCustomFields([]);

      if (categoryId) {
        loadAttributes();
      }
    }
  }, [isOpen, product, categoryId]);

  async function loadAttributes() {
    setLoading(true);
    try {
      const res = await getCiceksepetiCategoryAttributes("product_modal", String(categoryId));
      if (res.success && res.attributes) {
        setApiAttributes(res.attributes);
        const initialValues: Record<string, any> = {};
        res.attributes.forEach((attr: any) => {
          if (attr.selectedAttributeValueId) {
            initialValues[String(attr.id)] = { attributeValueId: String(attr.selectedAttributeValueId) };
          } else if (attr.customValue) {
            initialValues[String(attr.id)] = { customValue: attr.customValue };
          }
        });
        setAttributeValues(initialValues);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleValueChange(attributeId: string, valueId: string) {
    setAttributeValues((prev) => ({
      ...prev,
      [attributeId]: { attributeValueId: valueId },
    }));
  }

  function handleCustomValueChange(attributeId: string, customVal: string) {
    setAttributeValues((prev) => ({
      ...prev,
      [attributeId]: { customValue: customVal },
    }));
  }

  function addCustomField() {
    setCustomFields((prev) => [
      ...prev,
      { id: Date.now().toString(), name: "", value: "" },
    ]);
  }

  function removeCustomField(id: string) {
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
  }

  function updateCustomField(id: string, key: "name" | "value", val: string) {
    setCustomFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [key]: val } : f))
    );
  }

  async function handleSubmit() {
    // Check required API attributes
    const missingRequired = apiAttributes.filter(
      (attr) => (attr.required || attr.isRequired) && !attributeValues[String(attr.id)]?.attributeValueId && !attributeValues[String(attr.id)]?.customValue
    );

    if (missingRequired.length > 0) {
      toast.error(`Lütfen zorunlu alanları doldurun: ${missingRequired.map((a) => a.name).join(", ")}`);
      return;
    }

    const selectedAttributes: any[] = [];

    // 1) API'den gelen nitelikler
    Object.entries(attributeValues).forEach(([attrId, val]) => {
      if (val.attributeValueId) {
        selectedAttributes.push({
          attributeId: Number(attrId),
          attributeValueId: Number(val.attributeValueId),
        });
      } else if (val.customValue) {
        selectedAttributes.push({
          attributeId: Number(attrId),
          customAttributeValue: String(val.customValue),
        });
      }
    });

    // Sadece Çiçeksepeti API'sinden gelen geçerli kategori nitelikleri gönderilir

    setSubmitting(true);
    try {
      const res = await syncProductsToCiceksepeti([product.id], "all", {
        attributes: selectedAttributes,
        deliveryType: Number(deliveryType),
        deliveryDays: Number(deliveryDays),
      });

      if (res.success) {
        toast.success(res.message || "Ürün başarıyla Çiçeksepeti'ye aktarıldı!");
        onSuccess();
        onClose();
      } else {
        toast.error(res.error || "Aktarım başarısız oldu.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Gönderim sırasında hata oluştu: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-700 text-lg font-bold">
            <Send className="w-5 h-5" />
            Çiçeksepeti Ürün Gönderme & Nitelik Düzenleme
          </DialogTitle>
          <DialogDescription className="text-xs">
            <span className="font-semibold text-gray-900">{product?.name}</span> ürünü için Çiçeksepeti Kategori ID:{" "}
            <code className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-mono font-bold text-xs">{categoryId || "Tanımsız"}</code>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-2">
          {!categoryId ? (
            <div className="p-4 bg-amber-50 text-amber-800 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>Bu ürüne özel bir Çiçeksepeti Kategori ID atanmamış. Lütfen önce ürün listesinden Kategori ID tanımlayın.</span>
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              {/* Teslimat Ayarları */}
              <div className="p-3 bg-rose-50/60 border border-rose-200 rounded-lg shadow-sm space-y-2">
                <p className="font-semibold text-rose-900 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  Teslimat & Kargo Ayarları
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium">Teslimat Tipi <span className="text-red-500">*</span></Label>
                    <Select value={deliveryType} onValueChange={setDeliveryType}>
                      <SelectTrigger className="w-full h-8 text-xs bg-white border-rose-200">
                        <SelectValue placeholder="Teslimat Tipi" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1" className="text-xs">Kargo İle Gönderi</SelectItem>
                        <SelectItem value="2" className="text-xs">Bayi / Özel Teslimat</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium">Teslimat Aralığı <span className="text-red-500">*</span></Label>
                    <Select value={deliveryDays} onValueChange={setDeliveryDays}>
                      <SelectTrigger className="w-full h-8 text-xs bg-white border-rose-200">
                        <SelectValue placeholder="Teslimat Aralığı" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1" className="text-xs">Aynı Gün / 1 Gün İçinde Kargo</SelectItem>
                        <SelectItem value="2" className="text-xs">1-2 Gün İçinde Kargo</SelectItem>
                        <SelectItem value="3" className="text-xs">2-3 Gün İçinde Kargo</SelectItem>
                        <SelectItem value="5" className="text-xs">3-5 Gün İçinde Kargo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>



              {/* Çiçeksepeti Canlı Kategori Nitelikleri */}
              {loading ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                  <span>Çiçeksepeti özel kategori özellikleri çekiliyor...</span>
                </div>
              ) : apiAttributes.length > 0 && (
                <div className="space-y-2 p-3 bg-amber-50/50 border border-amber-200 rounded-lg">
                  <p className="font-semibold text-amber-900">
                    Çiçeksepeti Kategori Nitelikleri (<span className="text-red-500">*</span> zorunlu)
                  </p>
                  <div className="space-y-2.5">
                    {apiAttributes.map((attr) => {
                      const isReq = attr.required || attr.isRequired;
                      const currentVal = attributeValues[String(attr.id)] || {};

                      return (
                        <div key={attr.id} className="space-y-1 bg-white p-2.5 rounded border border-amber-200">
                          <Label className="text-[11px] font-semibold flex items-center justify-between">
                            <span>
                              {attr.name} {isReq && <span className="text-red-500">*</span>}
                            </span>
                          </Label>

                          {attr.attributeValues && attr.attributeValues.length > 0 ? (
                            <Select
                              value={currentVal.attributeValueId || ""}
                              onValueChange={(val) => handleValueChange(String(attr.id), val)}
                            >
                              <SelectTrigger className="w-full h-8 text-xs bg-white">
                                <SelectValue placeholder={`${attr.name} seçiniz...`} />
                              </SelectTrigger>
                              <SelectContent className="max-h-56">
                                {attr.attributeValues.map((v: any) => (
                                  <SelectItem key={v.id} value={String(v.id)} className="text-xs">
                                    {v.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              placeholder={`${attr.name} giriniz...`}
                              value={currentVal.customValue || ""}
                              onChange={(e) => handleCustomValueChange(String(attr.id), e.target.value)}
                              className="h-8 text-xs bg-white"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Dinamik Ek Özellik Ekleme */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-800">Ek Özel Nitelik / Özellik Ekle</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCustomField}
                    className="h-7 text-xs gap-1 border-rose-200 text-rose-700 hover:bg-rose-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Özellik Ekle
                  </Button>
                </div>

                {customFields.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic">
                    Ekstra özel bir nitelik eklemek isterseniz yukarıdaki butona tıklayabilirsiniz.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {customFields.map((field) => (
                      <div key={field.id} className="flex items-center gap-2">
                        <Input
                          placeholder="Özellik Adı (Örn: Model)"
                          value={field.name}
                          onChange={(e) => updateCustomField(field.id, "name", e.target.value)}
                          className="h-8 text-xs bg-white flex-1"
                        />
                        <Input
                          placeholder="Değer (Örn: HD-919)"
                          value={field.value}
                          onChange={(e) => updateCustomField(field.id, "value", e.target.value)}
                          className="h-8 text-xs bg-white flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCustomField(field.id)}
                          className="h-8 w-8 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            İptal
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting || loading || !categoryId}
            className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Gönderiliyor...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Çiçeksepeti'ye Yükle
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
