"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2, PackageCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { getMissingDesiProducts, setDesiForProducts, type MissingDesiProduct } from "./actions";

type Store = "BIKE" | "MOTOR";
const STORE_LABEL: Record<Store, string> = { BIKE: "Bisiklet", MOTOR: "Motor" };

export default function MissingDesiPage() {
    const [store, setStore] = useState<Store>("MOTOR");
    const [products, setProducts] = useState<MissingDesiProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [desi, setDesi] = useState("1");
    const [saving, setSaving] = useState(false);

    const load = async (s: Store) => {
        setLoading(true);
        try {
            setProducts(await getMissingDesiProducts(s));
            setSelected(new Set());
        } catch (e: any) {
            toast.error(e?.message || "Liste alınamadı.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load(store);
    }, [store]);

    const allSelected = products.length > 0 && selected.size === products.length;
    const toggleAll = () => setSelected(allSelected ? new Set() : new Set(products.map((p) => p.id)));
    const toggle = (id: string) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const apply = async () => {
        const value = Number(desi.replace(",", "."));
        if (!Number.isFinite(value) || value <= 0) return toast.error("Geçerli bir desi girin.");
        if (!confirm(`Seçilen ${selected.size} ürüne ${value} desi yazılacak. Devam?`)) return;
        setSaving(true);
        try {
            const res = await setDesiForProducts([...selected], value);
            if (res.success) {
                toast.success(res.message);
                await load(store);
            } else {
                toast.error(res.message);
            }
        } catch (e: any) {
            toast.error(e?.message || "Kaydedilemedi.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
                <Link href="/admin/products">
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Ürünler
                    </Button>
                </Link>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Desisi Eksik Ürünler</h1>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                Desi, ağırlık ve ölçüsü girilmemiş, "Ücretsiz Kargo" işaretsiz aktif ürünler. Bu ürünlerde sepette ve ödemede
                kargo <b>ücretsiz</b> çıkar, kargoyu siz ödersiniz. Ürünleri seçip toplu desi yazın; doğru desiyi sonra ürün
                düzenleme sayfasından girebilirsiniz.
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
                    {(["MOTOR", "BIKE"] as Store[]).map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => setStore(s)}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                store === s ? "bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-800"
                            }`}
                        >
                            {STORE_LABEL[s]} sitesi
                        </button>
                    ))}
                </div>
                {!loading && (
                    <span className="text-sm text-gray-500">
                        {products.length} ürün{products.length > 0 && `, ${products.filter((p) => p.stock > 0).length} tanesi stokta`}
                    </span>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
            ) : products.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-16 text-gray-500">
                    <PackageCheck className="h-10 w-10 text-emerald-500" />
                    {STORE_LABEL[store]} sitesinde desisi eksik ürün yok.
                </div>
            ) : (
                <>
                    {/* Toplu desi */}
                    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-lg border bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <label className="flex items-center gap-2 text-sm font-medium">
                            <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                            Tümünü seç
                        </label>
                        <span className="text-sm text-gray-500">{selected.size} seçili</span>
                        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                            <Input
                                type="number"
                                min="0.01"
                                step="0.5"
                                value={desi}
                                onChange={(e) => setDesi(e.target.value)}
                                className="h-9 w-24"
                                aria-label="Desi"
                            />
                            <Button size="sm" onClick={apply} disabled={saving || selected.size === 0}>
                                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Truck className="h-4 w-4 mr-2" />}
                                Seçilenlere desi yaz
                            </Button>
                        </div>
                    </div>

                    <div className="divide-y rounded-lg border bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
                        {products.map((p) => (
                            <label key={p.id} className="flex cursor-pointer items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800">
                                    {p.image && <img src={p.image} alt="" className="h-full w-full object-contain" loading="lazy" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <Link
                                        href={`/admin/products/${p.id}/edit`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="line-clamp-2 text-sm font-medium text-gray-900 hover:text-[#17457C] dark:text-white"
                                    >
                                        {p.name}
                                    </Link>
                                    <p className="truncate text-xs text-gray-500">
                                        {p.sku || "-"} · {p.category}
                                        {p.store === "BOTH" && " · iki sitede ortak"}
                                    </p>
                                </div>
                                <span className={`shrink-0 text-sm font-semibold ${p.stock > 0 ? "text-gray-900 dark:text-white" : "text-gray-400"}`}>
                                    {p.stock > 0 ? `${p.stock} stok` : "stok yok"}
                                </span>
                            </label>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
