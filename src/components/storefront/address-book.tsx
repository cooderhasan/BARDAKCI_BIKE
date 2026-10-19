"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MapPin, Pencil, Plus, Star, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchablePicker } from "@/components/ui/searchable-picker";
import { getCityNames, getDistrictsOfCity } from "@/lib/cities";
import {
    saveAddress,
    setDefaultAddress,
    deleteAddress,
    type SavedAddress,
} from "@/app/(storefront)/account/addresses/actions";

const TITLE_SUGGESTIONS = ["Ev", "İş", "Diğer"];

function formatPhoneInput(raw: string) {
    let val = raw.replace(/\D/g, "");
    if (val.length > 11) val = val.substring(0, 11);
    let formatted = "";
    if (val.length > 0) {
        formatted = val.substring(0, 4);
        if (val.length > 4) formatted += " " + val.substring(4, 7);
        if (val.length > 7) formatted += " " + val.substring(7, 9);
        if (val.length > 9) formatted += " " + val.substring(9, 11);
    }
    return formatted;
}

/** Adres ekleme / düzenleme penceresi */
export function AddressFormDialog({
    open,
    onOpenChange,
    initial,
    defaultName,
    onSaved,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    initial?: SavedAddress | null;
    defaultName?: string;
    onSaved?: (id: string) => void;
}) {
    const [saving, setSaving] = useState(false);
    const [title, setTitle] = useState(initial?.title || "");
    const [city, setCity] = useState(initial?.city || "");
    const [district, setDistrict] = useState(initial?.district || "");
    const [makeDefault, setMakeDefault] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (!city || !district) {
            toast.error("Lütfen il ve ilçe seçin.");
            return;
        }
        setSaving(true);
        const res = await saveAddress({
            id: initial?.id,
            title: title || "Adresim",
            name: String(fd.get("name") || ""),
            phone: String(fd.get("phone") || ""),
            city,
            district,
            address: String(fd.get("address") || ""),
            isDefault: makeDefault,
        });
        setSaving(false);
        if (!res.success) {
            toast.error(res.error || "Adres kaydedilemedi.");
            return;
        }
        toast.success(initial ? "Adres güncellendi." : "Adres eklendi.");
        onOpenChange(false);
        if (res.id) onSaved?.(res.id);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{initial ? "Adresi Düzenle" : "Yeni Adres Ekle"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="addr-title">Adres Adı</Label>
                        <Input
                            id="addr-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Örn: Ev, İş"
                            maxLength={30}
                        />
                        <div className="flex gap-1.5">
                            {TITLE_SUGGESTIONS.map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setTitle(t)}
                                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${title === t ? "bg-[#17457C] text-white border-[#17457C]" : "border-gray-200 hover:border-[#17457C]"}`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="addr-name">Alıcı Ad Soyad / Firma *</Label>
                            <Input id="addr-name" name="name" required defaultValue={initial?.name || defaultName || ""} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="addr-phone">Telefon *</Label>
                            <Input
                                id="addr-phone"
                                name="phone"
                                type="tel"
                                required
                                placeholder="05XX XXX XX XX"
                                maxLength={15}
                                defaultValue={initial?.phone ? formatPhoneInput(initial.phone) : ""}
                                onChange={(e) => (e.target.value = formatPhoneInput(e.target.value))}
                            />
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label>İl *</Label>
                            <SearchablePicker
                                options={getCityNames()}
                                value={city}
                                onValueChange={(v) => {
                                    setCity(v);
                                    setDistrict("");
                                }}
                                placeholder="İl seçiniz"
                                searchPlaceholder="İl ara..."
                                title="İl Seçimi"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>İlçe *</Label>
                            <SearchablePicker
                                options={city ? getDistrictsOfCity(city) : []}
                                value={district}
                                onValueChange={setDistrict}
                                disabled={!city}
                                placeholder="İlçe seçiniz"
                                searchPlaceholder="İlçe ara..."
                                title="İlçe Seçimi"
                                emptyMessage={city ? "İlçe bulunamadı." : "Önce il seçiniz."}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="addr-address">Adres *</Label>
                        <Textarea
                            id="addr-address"
                            name="address"
                            required
                            rows={3}
                            defaultValue={initial?.address || ""}
                            placeholder="Mahalle, cadde, sokak, bina ve daire no"
                        />
                    </div>
                    {!initial?.isDefault && (
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                                type="checkbox"
                                checked={makeDefault}
                                onChange={(e) => setMakeDefault(e.target.checked)}
                                className="h-4 w-4 accent-[#17457C]"
                            />
                            Varsayılan adresim yap
                        </label>
                    )}
                    <Button type="submit" className="w-full bg-[#17457C] hover:bg-[#0f3460]" disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : initial ? "Kaydet" : "Adresi Ekle"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/** Hesabım > Adreslerim: adres kartları, ekle / düzenle / sil / varsayılan yap */
export function AddressBook({ addresses, defaultName }: { addresses: SavedAddress[]; defaultName?: string }) {
    const router = useRouter();
    const [editing, setEditing] = useState<SavedAddress | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);

    const openNew = () => {
        setEditing(null);
        setDialogOpen(true);
    };
    const openEdit = (a: SavedAddress) => {
        setEditing(a);
        setDialogOpen(true);
    };

    const handleDefault = async (id: string) => {
        setBusyId(id);
        const res = await setDefaultAddress(id);
        setBusyId(null);
        if (res.success) {
            toast.success("Varsayılan adres güncellendi.");
            router.refresh();
        } else toast.error(res.error || "İşlem yapılamadı.");
    };

    const handleDelete = async (a: SavedAddress) => {
        if (!confirm(`"${a.title}" adresi silinsin mi?`)) return;
        setBusyId(a.id);
        const res = await deleteAddress(a.id);
        setBusyId(null);
        if (res.success) {
            toast.success("Adres silindi.");
            router.refresh();
        } else toast.error(res.error || "Adres silinemedi.");
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold mb-1">Adreslerim</h1>
                    <p className="text-gray-500 text-sm">Teslimat adreslerinizi kaydedin; siparişte tek tıkla seçin.</p>
                </div>
                <Button onClick={openNew} className="bg-[#17457C] hover:bg-[#0f3460] self-start sm:self-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Yeni Adres Ekle
                </Button>
            </div>

            {addresses.length === 0 ? (
                <div className="rounded-xl border border-dashed p-10 text-center text-gray-500">
                    <MapPin className="h-8 w-8 mx-auto mb-3 text-gray-300" />
                    Henüz kayıtlı adresiniz yok.
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {addresses.map((a) => (
                        <div
                            key={a.id}
                            className={`rounded-xl border p-4 bg-white dark:bg-gray-900 ${a.isDefault ? "border-[#17457C]/40 ring-1 ring-[#17457C]/20" : "border-gray-200 dark:border-gray-800"}`}
                        >
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <MapPin className="h-4 w-4 text-[#17457C] shrink-0" />
                                    <span className="font-bold truncate">{a.title}</span>
                                </div>
                                {a.isDefault && (
                                    <span className="text-[10px] font-bold uppercase tracking-wide bg-[#17457C] text-white px-2 py-0.5 rounded-full">
                                        Varsayılan
                                    </span>
                                )}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-300 space-y-0.5">
                                <p className="font-semibold text-gray-900 dark:text-white">{a.name}</p>
                                <p>{a.address}</p>
                                <p>{a.district} / {a.city}</p>
                                <p>{a.phone}</p>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-4">
                                <Button variant="outline" size="sm" onClick={() => openEdit(a)}>
                                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                                    Düzenle
                                </Button>
                                {!a.isDefault && (
                                    <Button variant="outline" size="sm" onClick={() => handleDefault(a.id)} disabled={busyId === a.id}>
                                        <Star className="h-3.5 w-3.5 mr-1.5" />
                                        Varsayılan Yap
                                    </Button>
                                )}
                                {addresses.length > 1 && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => handleDelete(a)}
                                        disabled={busyId === a.id}
                                    >
                                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                        Sil
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {dialogOpen && (
                <AddressFormDialog
                    key={editing?.id || "new"}
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    initial={editing}
                    defaultName={defaultName}
                    onSaved={() => router.refresh()}
                />
            )}
        </div>
    );
}
