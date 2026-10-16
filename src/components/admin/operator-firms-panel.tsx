"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveOperatorFirm, deleteOperatorFirm } from "@/app/admin/(protected)/brands/actions";

export interface OperatorFirmRow {
    id: string;
    name: string;
    address: string;
    email: string;
    _count?: { manufacturerOf: number; importerOf: number };
}

const empty = { name: "", address: "", email: "" };

/**
 * İmalatçı / ithalatçı firma kartları. Bir kez girilir; markada "İmalatçı" veya "İthalatçı" olarak seçilir,
 * pazaryeri gönderim formlarında (Trendyol, HB, N11, Idefix, Çiçeksepeti) otomatik doldurulur.
 */
export function OperatorFirmsPanel({ firms }: { firms: OperatorFirmRow[] }) {
    const [open, setOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState(empty);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);

    const startNew = () => {
        setEditId(null);
        setForm(empty);
        setShowForm(true);
    };
    const startEdit = (f: OperatorFirmRow) => {
        setEditId(f.id);
        setForm({ name: f.name, address: f.address, email: f.email });
        setShowForm(true);
    };

    const save = async () => {
        setSaving(true);
        try {
            const res = await saveOperatorFirm(editId, form);
            if (!res.success) {
                toast.error(res.message);
                return;
            }
            toast.success(editId ? "Firma güncellendi." : "Firma eklendi.");
            setShowForm(false);
            setForm(empty);
            setEditId(null);
        } finally {
            setSaving(false);
        }
    };

    const remove = async (f: OperatorFirmRow) => {
        const used = (f._count?.manufacturerOf || 0) + (f._count?.importerOf || 0);
        const msg = used > 0 ? `"${f.name}" ${used} markada seçili. Silinirse o markalardan kaldırılacak. Devam edilsin mi?` : `"${f.name}" silinsin mi?`;
        if (!confirm(msg)) return;
        await deleteOperatorFirm(f.id);
        toast.success("Firma silindi.");
    };

    return (
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
            <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 p-3 text-left">
                <Building2 className="h-4 w-4 shrink-0 text-blue-600" />
                <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-blue-900 dark:text-blue-200">İmalatçı / İthalatçı Firmaları ({firms.length})</span>
                    <span className="block text-xs text-blue-700 dark:text-blue-300">
                        Bir kez girin, markada seçin; pazaryerine ürün gönderirken üretici / ithalatçı alanları otomatik dolar.
                    </span>
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-blue-600 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
                <div className="space-y-2 border-t border-blue-200 p-3 dark:border-blue-900">
                    {firms.length === 0 && !showForm && <p className="text-xs text-gray-500">Henüz firma eklenmedi.</p>}
                    {firms.map((f) => (
                        <div key={f.id} className="flex items-start gap-2 rounded-md border bg-white p-2 text-xs dark:bg-gray-800">
                            <div className="min-w-0 flex-1">
                                <div className="font-semibold">{f.name}</div>
                                <div className="break-words text-gray-500">{f.address}</div>
                                <div className="text-gray-500">{f.email}</div>
                                {f._count && (f._count.manufacturerOf > 0 || f._count.importerOf > 0) && (
                                    <div className="mt-1 text-[10px] text-blue-600">
                                        {f._count.manufacturerOf > 0 && `${f._count.manufacturerOf} markada imalatçı`}
                                        {f._count.manufacturerOf > 0 && f._count.importerOf > 0 && " · "}
                                        {f._count.importerOf > 0 && `${f._count.importerOf} markada ithalatçı`}
                                    </div>
                                )}
                            </div>
                            <Button size="sm" variant="ghost" type="button" onClick={() => startEdit(f)}>
                                <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" type="button" className="text-red-600" onClick={() => remove(f)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}

                    {showForm ? (
                        <div className="space-y-2 rounded-md border border-blue-300 bg-white p-2 dark:bg-gray-800">
                            <div className="text-xs font-semibold">{editId ? "Firmayı Düzenle" : "Yeni Firma"}</div>
                            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ünvan (ör. M.GÜRLER MOTOSİKLET OTOMOTİV ...)" className="h-9 text-sm" />
                            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Açık adres" className="h-9 text-sm" />
                            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="E-posta" type="email" className="h-9 text-sm" />
                            <div className="flex justify-end gap-2">
                                <Button size="sm" type="button" variant="outline" onClick={() => setShowForm(false)}>
                                    Vazgeç
                                </Button>
                                <Button size="sm" type="button" onClick={save} disabled={saving}>
                                    {saving ? "Kaydediliyor..." : "Kaydet"}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Button size="sm" type="button" variant="outline" onClick={startNew}>
                            <Plus className="mr-1 h-4 w-4" /> Firma Ekle
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
