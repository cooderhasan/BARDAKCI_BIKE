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
import { Loader2, Send, AlertCircle } from "lucide-react";
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
  const [attributes, setAttributes] = useState<any[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<string, { attributeValueId?: string; customValue?: string }>>({});

  const categoryId =
    product?.ciceksepetiProduct?.ciceksepetiCategoryId ||
    product?.category?.ciceksepetiCategoryId ||
    product?.categories?.[0]?.ciceksepetiCategoryId ||
    "";

  useEffect(() => {
    if (isOpen && categoryId) {
      loadAttributes();
    }
  }, [isOpen, categoryId]);

  async function loadAttributes() {
    setLoading(true);
    try {
      const res = await getCiceksepetiCategoryAttributes("product_modal", String(categoryId));
      if (res.success && res.attributes) {
        setAttributes(res.attributes);
        const initialValues: Record<string, any> = {};
        res.attributes.forEach((attr: any) => {
          if (attr.selectedAttributeValueId) {
            initialValues[String(attr.id)] = { attributeValueId: String(attr.selectedAttributeValueId) };
          } else if (attr.customValue) {
            initialValues[String(attr.id)] = { customValue: attr.customValue };
          }
        });
        setAttributeValues(initialValues);
      } else {
        toast.error(res.error || "Çiçeksepeti kategori nitelikleri yüklenemedi.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Nitelikler yüklenirken hata oluştu.");
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

  async function handleSubmit() {
    // Check required attributes
    const missingRequired = attributes.filter(
      (attr) => (attr.required || attr.isRequired) && !attributeValues[String(attr.id)]?.attributeValueId && !attributeValues[String(attr.id)]?.customValue
    );

    if (missingRequired.length > 0) {
      toast.error(`Lütfen zorunlu alanları doldurun: ${missingRequired.map((a) => a.name).join(", ")}`);
      return;
    }

    setSubmitting(true);
    try {
      // Direct sync call for single product
      const res = await syncProductsToCiceksepeti([product.id], "all");
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
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-700">
            <Send className="w-5 h-5" />
            Çiçeksepeti Ürün Gönderme & Nitelik Seçimi
          </DialogTitle>
          <DialogDescription>
            <span className="font-semibold text-gray-900">{product?.name}</span> ürünü için Çiçeksepeti Kategori ID:{" "}
            <code className="bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-mono text-xs">{categoryId || "Tanımsız"}</code>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-2">
          {!categoryId ? (
            <div className="p-4 bg-amber-50 text-amber-800 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>Bu ürüne özel bir Çiçeksepeti Kategori ID atanmamış. Lütfen önce listeden Kategori ID tanımlayın.</span>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-sm gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-rose-600" />
              <span>Çiçeksepeti kategori özellikleri yükleniyor...</span>
            </div>
          ) : attributes.length === 0 ? (
            <div className="p-4 bg-gray-50 text-gray-600 rounded-lg text-sm text-center">
              Bu kategori için ek zorunlu özellik bulunamadı. Doğrudan gönderebilirsiniz.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3 bg-rose-50/50 border border-rose-100 rounded-lg">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-rose-900">Teslimat Tipi <span className="text-red-500">*</span></Label>
                  <Select defaultValue="1">
                    <SelectTrigger className="w-full text-xs bg-white h-8">
                      <SelectValue placeholder="Teslimat Tipi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1" className="text-xs">Kargo ile Teslimat (1)</SelectItem>
                      <SelectItem value="2" className="text-xs">Özel Teslimat / Kendi Aracıyla (2)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-rose-900">Kargoya Veriliş Süresi <span className="text-red-500">*</span></Label>
                  <Select defaultValue="1">
                    <SelectTrigger className="w-full text-xs bg-white h-8">
                      <SelectValue placeholder="Kargo Süresi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1" className="text-xs">Aynı Gün / 1 Gün</SelectItem>
                      <SelectItem value="2" className="text-xs">2 Gün</SelectItem>
                      <SelectItem value="3" className="text-xs">3 Gün</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Kırmızı yıldızlı (<span className="text-red-500">*</span>) alanlar Çiçeksepeti tarafından zorunlu tutulmaktadır.
              </p>
              {attributes.map((attr) => {
                const isReq = attr.required || attr.isRequired;
                const currentVal = attributeValues[String(attr.id)] || {};

                return (
                  <div key={attr.id} className="space-y-1.5 bg-muted/40 p-3 rounded-lg border">
                    <Label className="text-xs font-semibold flex items-center justify-between">
                      <span>
                        {attr.name} {isReq && <span className="text-red-500">*</span>}
                      </span>
                    </Label>

                    {attr.attributeValues && attr.attributeValues.length > 0 ? (
                      <Select
                        value={currentVal.attributeValueId || ""}
                        onValueChange={(val) => handleValueChange(String(attr.id), val)}
                      >
                        <SelectTrigger className="w-full text-xs bg-white">
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
                        className="text-xs bg-white"
                      />
                    )}
                  </div>
                );
              })}
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
            className="bg-rose-600 hover:bg-rose-700 text-white"
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
