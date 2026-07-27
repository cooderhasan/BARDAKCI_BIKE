"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Badge } from "@/components/ui/badge";
import {
  getCiceksepetiCategoryAttributes,
  saveCiceksepetiCategoryAttributes,
} from "@/app/admin/(protected)/integrations/ciceksepeti/actions";
import { toast } from "sonner";
import { SlidersHorizontal, Loader2, Save, CheckCircle2, AlertCircle } from "lucide-react";

interface Props {
  categoryId: string;
  categoryName: string;
  ciceksepetiCategoryId: string;
}

export function CiceksepetiAttributeMappingModal({
  categoryId,
  categoryName,
  ciceksepetiCategoryId,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attributes, setAttributes] = useState<any[]>([]);

  async function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);

    if (isOpen) {
      setLoading(true);
      const res = await getCiceksepetiCategoryAttributes(categoryId, ciceksepetiCategoryId);
      setLoading(false);

      if (res.success) {
        setAttributes(res.attributes || []);
      } else {
        toast.error(res.error || "Özellikler yüklenemedi.");
      }
    }
  }

  function handleValueChange(attrId: string, valueId: string) {
    setAttributes((prev) =>
      prev.map((attr) => {
        if (String(attr.id) === String(attrId)) {
          const selectedValObj = attr.attributeValues?.find(
            (v: any) => String(v.id) === String(valueId)
          );
          return {
            ...attr,
            selectedAttributeValueId: valueId,
            selectedAttributeValueName: selectedValObj?.name || null,
          };
        }
        return attr;
      })
    );
  }

  function handleCustomValueChange(attrId: string, customVal: string) {
    setAttributes((prev) =>
      prev.map((attr) => {
        if (String(attr.id) === String(attrId)) {
          return {
            ...attr,
            customValue: customVal,
          };
        }
        return attr;
      })
    );
  }

  async function handleSave() {
    setSaving(true);

    const mappings = attributes.map((attr) => ({
      attributeId: String(attr.id),
      attributeName: attr.name,
      isRequired: Boolean(attr.required),
      selectedAttributeValueId: attr.selectedAttributeValueId || null,
      selectedAttributeValueName: attr.selectedAttributeValueName || null,
      customValue: attr.customValue || null,
      values: attr.attributeValues || null,
    }));

    const res = await saveCiceksepetiCategoryAttributes(
      categoryId,
      ciceksepetiCategoryId,
      mappings
    );
    setSaving(false);

    if (res.success) {
      toast.success(res.message);
      setOpen(false);
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 gap-1.5 text-xs"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          🌸 Çiçeksepeti Nitelik Eşleme
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
            <SlidersHorizontal className="w-5 h-5 text-rose-600" />
            Çiçeksepeti Kategori Özellikleri ({categoryName})
          </DialogTitle>
          <DialogDescription>
            Çiçeksepeti Kategori ID: <code className="font-mono text-xs bg-rose-100 text-rose-800 px-1 rounded">{ciceksepetiCategoryId}</code>. Bu kategorideki ürünler gönderilirken kullanılacak varsayılan nitelik değerlerini belirleyin.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 py-4 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-rose-600" />
              <span>Çiçeksepeti kategori özellikleri yükleniyor...</span>
            </div>
          ) : attributes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p>Bu kategori için özel bir zorunlu nitelik bulunmuyor veya doğrudan ürün aktarılabilir.</p>
            </div>
          ) : (
            attributes.map((attr) => {
              const hasOptions = attr.attributeValues && attr.attributeValues.length > 0;

              return (
                <div
                  key={attr.id}
                  className="p-3.5 rounded-lg border bg-card space-y-2 text-sm shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <Label className="font-medium flex items-center gap-2">
                      <span>{attr.name}</span>
                      {attr.required ? (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          Zorunlu
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                          Opsiyonel
                        </Badge>
                      )}
                    </Label>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      ID: {attr.id}
                    </span>
                  </div>

                  {hasOptions ? (
                    <Select
                      value={attr.selectedAttributeValueId || "NONE"}
                      onValueChange={(val) =>
                        handleValueChange(attr.id, val === "NONE" ? "" : val)
                      }
                    >
                      <SelectTrigger className="w-full h-9 text-xs">
                        <SelectValue placeholder="Bir seçenek belirleyin..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem value="NONE">-- Seçim Yok --</SelectItem>
                        {attr.attributeValues.map((v: any) => (
                          <SelectItem key={v.id} value={String(v.id)} className="text-xs">
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder="Değer yazın (örn: Kırmızı, XL, Alüminyum...)"
                      value={attr.customValue || ""}
                      onChange={(e) => handleCustomValueChange(attr.id, e.target.value)}
                      className="h-9 text-xs"
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            İptal
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="bg-rose-600 hover:bg-rose-700 text-white gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Nitelik Haritasını Kaydet
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
