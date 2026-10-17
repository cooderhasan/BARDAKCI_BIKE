"use client";

import { useState, useEffect, useMemo } from "react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, AlertCircle, Plus, Trash2, Tag, Search, ChevronDown, Check, Building2 } from "lucide-react";
import { getCiceksepetiCategoryAttributes, syncProductsToCiceksepeti } from "@/app/admin/(protected)/integrations/ciceksepeti/actions";
import { toast } from "sonner";
import { getProductOperators } from "@/app/admin/(protected)/brands/actions";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  product: any;
  onSuccess: () => void;
}

// Kategoriye özel niteliklerin istemci tarafında bellekte tutulması (Önbellekleme / Caching)
const attributeCacheMap = new Map<string, any[]>();

function SearchableAttributeSelect({
  attr,
  value,
  onChange,
}: {
  attr: any;
  value: string;
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const selectedItem = (attr.attributeValues || []).find(
    (v: any) => String(v.id) === String(value)
  );

  const filteredValues = useMemo(() => {
    const vals = attr.attributeValues || [];
    if (!searchTerm.trim()) return vals;
    const norm = searchTerm.toLowerCase().trim();
    // Birebir eşleşen en üstte, sonra bununla başlayanlar (ör. "L" aranınca önce "L", sonra "L/XL", sonra içinde L geçenler)
    const rank = (n: string) => (n === norm ? 0 : n.startsWith(norm) ? 1 : 2);
    return vals
      .filter((v: any) => v.name?.toLowerCase().includes(norm))
      .sort((a: any, b: any) => rank(String(a.name).toLowerCase().trim()) - rank(String(b.name).toLowerCase().trim()));
  }, [attr.attributeValues, searchTerm]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full h-8 text-xs justify-between bg-white border-amber-200 text-left font-normal px-2.5 hover:bg-amber-50/50"
        >
          <span className="truncate">
            {selectedItem ? selectedItem.name : `${attr.name} seçiniz...`}
          </span>
          <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50 text-amber-700" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-1.5 shadow-xl border border-amber-200 bg-white z-[99999]"
        align="start"
        sideOffset={4}
      >
        {attr.attributeValues?.length > 5 && (
          <div className="relative mb-1.5">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={`${attr.name} içinde ara...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-7 text-xs pl-8 bg-slate-50 border-slate-200 focus:bg-white"
              autoFocus
            />
          </div>
        )}
        <div className="max-h-56 overflow-y-auto space-y-0.5 pr-0.5">
          {/* Seçimi Temizle / Boş Bırak */}
          <div
            onClick={() => {
              onChange("");
              setOpen(false);
              setSearchTerm("");
            }}
            className="flex items-center justify-between px-2.5 py-1.5 rounded text-xs cursor-pointer text-muted-foreground hover:bg-slate-100 border-b mb-1 italic"
          >
            <span>-- Seçimi Kaldır (Boş Bırak) --</span>
            {!value && <Check className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 ml-1" />}
          </div>

          {filteredValues.length === 0 ? (
            <div className="p-3 text-center text-xs text-muted-foreground">
              "{searchTerm}" ile eşleşen seçenek bulunamadı.
            </div>
          ) : (
            filteredValues.slice(0, 300).map((v: any) => {
              const isSelected = String(v.id) === String(value);
              return (
                <div
                  key={v.id}
                  onClick={() => {
                    onChange(String(v.id));
                    setOpen(false);
                    setSearchTerm("");
                  }}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded text-xs cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-rose-50 text-rose-700 font-semibold"
                      : "hover:bg-amber-50 text-slate-700"
                  }`}
                >
                  <span className="truncate">{v.name}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-rose-600 flex-shrink-0 ml-1" />}
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
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
  
  // Teslimat Ayarları (2 = Kargo ile Gönderim, 5 = 1-3 İş Günü Standart Kargo)
  const [deliveryType, setDeliveryType] = useState<string>("2");
  const [deliveryDays, setDeliveryDays] = useState<string>("5");

  // Dinamik Eklenen Özel Nitelikler
  const [customFields, setCustomFields] = useState<{ id: string; name: string; value: string }[]>([]);

  // İktisadi İşletmeci Alanları
  const [showOperatorContacts, setShowOperatorContacts] = useState(false);
  const [operatorContacts, setOperatorContacts] = useState<Record<number, { name: string; email: string; address: string }>>({
    1: { name: "", email: "", address: "" }, // İmalatçı
    2: { name: "", email: "", address: "" }, // İthalatçı
    3: { name: "", email: "", address: "" }, // Yetkili Temsilci
    4: { name: "", email: "", address: "" }, // İfa Hizmet Sağlayıcısı
  });

  function updateOperatorContact(type: number, field: "name" | "email" | "address", val: string) {
    setOperatorContacts((prev) => ({
      ...prev,
      [type]: {
        ...(prev as any)[type],
        [field]: val,
      },
    }));
  }

  const categoryId =
    product?.ciceksepetiProduct?.ciceksepetiCategoryId ||
    product?.category?.ciceksepetiCategoryId ||
    product?.categories?.[0]?.ciceksepetiCategoryId ||
    "";

  useEffect(() => {
    if (isOpen) {
      setAttributeValues({});
      setCustomFields([]);

      // İmalatçı / ithalatçı: markaya tanımlı firmalardan doldurulur (Markalar sayfası); boş kalırsa gönderilmez
      const emptyOc = { name: "", email: "", address: "" };
      setOperatorContacts({ 1: { ...emptyOc }, 2: { ...emptyOc }, 3: { ...emptyOc }, 4: { ...emptyOc } });
      setShowOperatorContacts(false);
      if (product?.id) {
        getProductOperators(product.id)
          .then((ops) => {
            if (!ops?.manufacturer && !ops?.importer) return;
            setOperatorContacts((prev) => {
              const next = { ...prev };
              if (ops.manufacturer) next[1] = { ...ops.manufacturer };
              if (ops.importer) next[2] = { ...ops.importer };
              return next;
            });
            setShowOperatorContacts(true);
          })
          .catch(() => {});
      }

      if (categoryId) {
        loadAttributes();
      }
    }
  }, [isOpen, product, categoryId]);

  async function loadAttributes() {
    const cacheKey = String(categoryId);

    // 1) Bellek Önbelleği (Client Cache) Kontrolü - Anında gösterim!
    if (attributeCacheMap.has(cacheKey)) {
      const cachedAttrs = attributeCacheMap.get(cacheKey)!;
      setApiAttributes(cachedAttrs);
      const initialValues: Record<string, any> = {};
      cachedAttrs.forEach((attr: any) => {
        if (attr.selectedAttributeValueId) {
          initialValues[String(attr.id)] = { attributeValueId: String(attr.selectedAttributeValueId) };
        } else if (attr.customValue) {
          initialValues[String(attr.id)] = { customValue: attr.customValue };
        }
      });
      setAttributeValues(initialValues);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await getCiceksepetiCategoryAttributes("product_modal", cacheKey);
      if (res.success && res.attributes) {
        attributeCacheMap.set(cacheKey, res.attributes);
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

  // --- Varyantlı ürün ---
  // ÇS kategorisindeki varyant yapan özellikler (tipi "Variant Özelliği", ör. 147 Renk + 7 Beden): her varyant aynı ana ürün
  // kodu altında bu özelliklerin hepsiyle gider (ÇS dokümanındaki örnek gibi). Önceden tek özellik gönderilip her renk ayrı
  // grup yapılıyordu; renk de varyant özelliği olan kategoride ÇS "Birden fazla varyant yapan özelliğe izin verilmiyor" diyordu.
  // Kategoride olmayan boyut (ör. beden varyant özelliği yoksa beden) ayrı ürün grubu olur. Değerler ÇS listesinden.
  const csNorm = (x: any) => String(x ?? "").toLocaleLowerCase("tr-TR").trim();
  const variantRows = (product?.variants || []).filter((v: any) => v.isActive !== false && (v.sku || v.barcode));
  // Varyant yapan özellik: varianter=true ya da tipi "Variant Özelliği" (ÇS dokümanı)
  const isVarAttr = (a: any) => !!(a?.varianter || a?.isVariantProperty || /variant/i.test(String(a?.type || "")));
  const varAttrs = apiAttributes.filter((a: any) => isVarAttr(a));
  const variantPlanInfo = (() => {
    if (variantRows.length === 0 || varAttrs.length === 0) return null;
    const isSize = (a: any) => /beden|boy|numara|ebat|ölçü|olcu|size/.test(csNorm(a.name));
    const isColor = (a: any) => /renk|color/.test(csNorm(a.name));
    const colors = new Set(variantRows.map((v: any) => v.color).filter(Boolean));
    const sizes = new Set(variantRows.map((v: any) => v.size).filter(Boolean));
    const sizeAttr = varAttrs.find(isSize);
    const colorAttr = varAttrs.find(isColor);
    const dims: { attr: any; source: "color" | "size" }[] = [];
    if (colors.size > 0 && colorAttr) dims.push({ attr: colorAttr, source: "color" });
    if (sizes.size > 0 && sizeAttr) dims.push({ attr: sizeAttr, source: "size" });
    if (dims.length === 0) dims.push({ attr: varAttrs[0], source: sizes.size > 0 ? "size" : "color" });
    // ÇS'de renk "ürün yapan" özellik: her renk ayrı ürün grubu (mainProductCode) olur, renk yine de her varyantta gönderilir;
    // beden grup içinde seçenektir. (Tek grupta iki renk → "Birden fazla ürün yapan özelliğe izin verilmiyor",
    // renk gönderilmezse → "Birden fazla varyant yapan özelliğe izin verilmiyor".)
    const groupBy =
      colors.size > 1
        ? ("color" as const)
        : sizes.size > 1 && !dims.some((d) => d.source === "size")
          ? ("size" as const)
          : null;
    return { dims, groupBy };
  })();
  // Varyant ID -> { özellik ID -> değer ID }
  const [variantDimValues, setVariantDimValues] = useState<Record<string, Record<string, string>>>({});
  useEffect(() => {
    if (!variantPlanInfo) return;
    const next: Record<string, Record<string, string>> = {};
    for (const v of variantRows) {
      next[v.id] = {};
      for (const d of variantPlanInfo.dims) {
        const src = d.source === "size" ? v.size : v.color;
        const hit = (d.attr.attributeValues || []).find((x: any) => csNorm(x.name) === csNorm(src));
        if (hit) next[v.id][String(d.attr.id)] = String(hit.id);
      }
    }
    setVariantDimValues(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiAttributes, product?.id]);
  const variantGroupKey = (v: any) => (variantPlanInfo?.groupBy ? String(v[variantPlanInfo.groupBy] || "") : "");

  // Seçili varyant oluşturan özellikleri bul (varyantlı üründe varyant tablosu kullanılır)
  const selectedVarianterAttrs = variantPlanInfo ? [] : apiAttributes.filter(
    (attr) =>
      isVarAttr(attr) &&
      (attributeValues[String(attr.id)]?.attributeValueId || attributeValues[String(attr.id)]?.customValue)
  );

  async function handleSubmit() {
    // 1) Birden fazla varyant özelliği seçildiyse engelle
    if (selectedVarianterAttrs.length > 1) {
      toast.error(
        `Çiçeksepeti kuralı: Tek bir üründe birden fazla varyant oluşturan özellik seçilemez. Lütfen şu özelliklerden yalnızca 1 tanesini seçip diğerlerini boş bırakın: ${selectedVarianterAttrs.map((a) => a.name).join(", ")}`,
        { duration: 7000 }
      );
      return;
    }

    // Varyantlı ürün: her varyantın tüm varyant özellikleri seçilmiş ve grup içinde benzersiz olmalı
    let variantPlan: { variantId: string; groupKey: string; attributes: { attributeId: number; attributeValueId: number }[] }[] | undefined;
    if (variantPlanInfo) {
      const vLabel = (v: any) => [v.color, v.size].filter(Boolean).join(" / ");
      const missing: string[] = [];
      for (const v of variantRows) {
        for (const d of variantPlanInfo.dims) {
          if (!variantDimValues[v.id]?.[String(d.attr.id)]) missing.push(`${vLabel(v)}: ${d.attr.name}`);
        }
      }
      if (missing.length > 0) {
        toast.error(`Varyant değeri seçilmemiş: ${missing.slice(0, 6).join(", ")}${missing.length > 6 ? " ..." : ""}`);
        return;
      }
      const seen = new Map<string, string>();
      for (const v of variantRows) {
        const k = `${variantGroupKey(v)}|${variantPlanInfo.dims.map((d) => variantDimValues[v.id][String(d.attr.id)]).join("|")}`;
        if (seen.has(k)) {
          toast.error(`${seen.get(k)} ve ${vLabel(v)} için aynı değerler seçilmiş; Çiçeksepeti bunları ayırt edemez.`);
          return;
        }
        seen.set(k, vLabel(v));
      }
      variantPlan = variantRows.map((v: any) => ({
        variantId: v.id,
        groupKey: variantGroupKey(v),
        attributes: variantPlanInfo.dims.map((d) => ({
          attributeId: Number(d.attr.id),
          attributeValueId: Number(variantDimValues[v.id][String(d.attr.id)]),
        })),
      }));
    }
    const varAttrIds = new Set(variantPlanInfo ? varAttrs.map((a: any) => String(a.id)) : []);

    const missingRequired = apiAttributes.filter(
      (attr) => !varAttrIds.has(String(attr.id)) && (attr.required || attr.isRequired) && !attributeValues[String(attr.id)]?.attributeValueId && !attributeValues[String(attr.id)]?.customValue
    );

    if (missingRequired.length > 0) {
      toast.error(`Lütfen zorunlu alanları doldurun: ${missingRequired.map((a) => a.name).join(", ")}`);
      return;
    }

    const selectedAttributes: any[] = [];

    Object.entries(attributeValues).forEach(([attrId, val]) => {
      if (varAttrIds.has(String(attrId))) return; // varyant özellikleri varyant başına gider
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

    const formattedOperatorContacts: any[] = [];
    [1, 2, 3, 4].forEach((type) => {
      const oc = (operatorContacts as any)[type];
      if (oc?.name?.trim() && oc?.address?.trim() && oc?.email?.trim()) {
        formattedOperatorContacts.push({
          type,
          name: oc.name.trim(),
          address: oc.address.trim(),
          email: oc.email.trim(),
        });
      }
    });

    setSubmitting(true);
    try {
      const res = await syncProductsToCiceksepeti([product.id], "all", {
        attributes: selectedAttributes,
        deliveryType: Number(deliveryType),
        deliveryDays: Number(deliveryDays),
        operatorContacts: formattedOperatorContacts.length > 0 ? formattedOperatorContacts : undefined,
        variantPlan,
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
                        <SelectItem value="2" className="text-xs">Kargo İle Gönderim</SelectItem>
                        <SelectItem value="1" className="text-xs">Kurye / Bayi Teslimatı</SelectItem>
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
                        <SelectItem value="5" className="text-xs">1-3 İş Günü Kargo</SelectItem>
                        <SelectItem value="1" className="text-xs">Aynı Gün Kargo</SelectItem>
                        <SelectItem value="2" className="text-xs">1-2 Gün İçinde Kargo</SelectItem>
                        <SelectItem value="3" className="text-xs">2-3 Gün İçinde Kargo</SelectItem>
                        <SelectItem value="6" className="text-xs">3-5 Gün İçinde Kargo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Çiçeksepeti İktisadi İşletmeci Alanları */}
              <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-blue-900 flex items-center gap-1.5 text-xs">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    Çiçeksepeti Ürün İktisadi İşletmeci Alanları (Opsiyonel)
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowOperatorContacts(!showOperatorContacts)}
                    className="h-6 text-[11px] text-blue-700 hover:bg-blue-100/50"
                  >
                    {showOperatorContacts ? "Gizle" : "Düzenle / Ekle"}
                  </Button>
                </div>

                {showOperatorContacts && (
                  <div className="space-y-3 pt-1">
                    {[
                      { type: 1, title: "İmalatçı" },
                      { type: 2, title: "İthalatçı" },
                      { type: 3, title: "Yetkili Temsilci" },
                      { type: 4, title: "İfa Hizmet Sağlayıcısı" },
                    ].map((item) => {
                      const oc = (operatorContacts as any)[item.type] || { name: "", email: "", address: "" };

                      return (
                        <div key={item.type} className="p-2.5 bg-white border border-blue-200 rounded-md space-y-2">
                          <p className="font-semibold text-blue-800 text-[11px] border-b pb-1">
                            {item.title} Bilgileri
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                            <div className="space-y-1">
                              <Label className="text-[10px]">İsim / Ünvan</Label>
                              <Input
                                placeholder="Firma Ünvanı"
                                value={oc.name}
                                onChange={(e) => updateOperatorContact(item.type, "name", e.target.value)}
                                className="h-7 text-xs bg-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">Email</Label>
                              <Input
                                placeholder="Email adresi"
                                value={oc.email}
                                onChange={(e) => updateOperatorContact(item.type, "email", e.target.value)}
                                className="h-7 text-xs bg-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">Adres</Label>
                              <Input
                                placeholder="Adres bilgisi"
                                value={oc.address}
                                onChange={(e) => updateOperatorContact(item.type, "address", e.target.value)}
                                className="h-7 text-xs bg-white"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Varyantlar: ÇS'de her varyant ayrı ürün; grup içinde tek varyant özelliği */}
              {!loading && variantRows.length > 0 && (
                <div className="space-y-2 p-3 bg-blue-50/60 border border-blue-200 rounded-lg">
                  <p className="font-semibold text-blue-900">🎨 Varyantlar ({variantRows.length})</p>
                  {!variantPlanInfo ? (
                    <p className="text-[11px] text-red-600">Bu Çiçeksepeti kategorisinde varyant özelliği yok; varyantlı ürün bu kategoriye doğru açılamaz.</p>
                  ) : (
                    <>
                      <p className="text-[11px] text-blue-800">
                        Çiçeksepeti bu kategoride varyantları <strong>{variantPlanInfo.dims.map((d) => d.attr.name).join(" + ")}</strong> ile ayırıyor.
                        {variantPlanInfo.groupBy && (
                          <> Her <strong>{variantPlanInfo.groupBy === "color" ? "renk" : "beden"}</strong> ayrı ürün sayfası olur.</>
                        )}{" "}
                        Değerler Çiçeksepeti listesinden seçilmeli (listede yoksa en yakın değeri seçin, ör. "Siyah / Mavi" için Mavi).
                      </p>
                      {variantRows.map((v: any) => (
                        <div key={v.id} className="rounded border bg-white p-2 space-y-1.5">
                          <div className="text-xs">
                            <span className="font-semibold">{[v.color, v.size].filter(Boolean).join(" / ")}</span>
                            <span className="ml-2 font-mono text-[10px] text-gray-500">{v.sku || v.barcode}</span>
                            {variantGroupKey(v) && <span className="ml-2 text-[10px] text-blue-600">sayfa: {variantGroupKey(v)}</span>}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {variantPlanInfo.dims.map((d) => (
                              <div key={d.attr.id} className="space-y-0.5">
                                <Label className="text-[10px] text-gray-600">{d.attr.name}</Label>
                                <SearchableAttributeSelect
                                  attr={d.attr}
                                  value={variantDimValues[v.id]?.[String(d.attr.id)] || ""}
                                  onChange={(val) =>
                                    setVariantDimValues((prev) => ({ ...prev, [v.id]: { ...(prev[v.id] || {}), [String(d.attr.id)]: val } }))
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* Çiçeksepeti Canlı Kategori Nitelikleri */}
              {loading ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                  <span>Çiçeksepeti özel kategori özellikleri çekiliyor...</span>
                </div>
              ) : apiAttributes.length > 0 && (
                <div className="space-y-3 p-3 bg-amber-50/50 border border-amber-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-amber-900">
                      Çiçeksepeti Kategori Nitelikleri (<span className="text-red-500">*</span> zorunlu)
                    </p>
                    <span className="text-[10px] text-amber-700 font-medium">
                      {apiAttributes.length} nitelik bulundu
                    </span>
                  </div>

                  {/* Birden Fazla Varyant Özelliği Seçildiyse Uyarı */}
                  {selectedVarianterAttrs.length > 1 && (
                    <div className="p-3 bg-red-50 border border-red-300 rounded-md text-red-900 text-xs flex items-start gap-2.5 shadow-sm">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-bold text-red-700">
                          ⚠️ Birden Fazla Varyant Özelliği Seçildi ({selectedVarianterAttrs.length} adet)
                        </p>
                        <p className="text-[11px] leading-relaxed">
                          Çiçeksepeti tekil ürünlerde <strong>en fazla 1 adet varyant özelliğine</strong> (örn. yalnızca Renk <u>veya</u> yalnızca Kadro Boyu) izin verir. Şu an seçili olan: <strong>{selectedVarianterAttrs.map((a) => a.name).join(", ")}</strong>. Lütfen bunlardan sadece 1 tanesini bırakıp diğerlerini <em>"-- Seçimi Kaldır --"</em> yapınız.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2.5">
                    {apiAttributes.filter((attr) => !(variantPlanInfo && isVarAttr(attr))).map((attr) => {
                      const isReq = attr.required || attr.isRequired;
                      const isVar = isVarAttr(attr);
                      const currentVal = attributeValues[String(attr.id)] || {};

                      return (
                        <div
                          key={attr.id}
                          className={`space-y-1.5 p-2.5 rounded border transition-colors ${
                            isVar && (currentVal.attributeValueId || currentVal.customValue)
                              ? "bg-purple-50/50 border-purple-200"
                              : "bg-white border-amber-200"
                          }`}
                        >
                          <Label className="text-[11px] font-semibold flex items-center justify-between flex-wrap gap-1">
                            <span className="flex items-center gap-1.5">
                              {attr.name} {isReq && <span className="text-red-500">*</span>}
                            </span>
                            <div className="flex items-center gap-1">
                              {isVar ? (
                                <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[9px] py-0 px-1 font-normal">
                                  Varyant Özelliği (Maks 1)
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px] text-gray-500 py-0 px-1 font-normal">
                                  Ürün Özelliği
                                </Badge>
                              )}
                            </div>
                          </Label>

                          {attr.attributeValues && attr.attributeValues.length > 0 ? (
                            <SearchableAttributeSelect
                              attr={attr}
                              value={currentVal.attributeValueId || ""}
                              onChange={(val) => handleValueChange(String(attr.id), val)}
                            />
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
