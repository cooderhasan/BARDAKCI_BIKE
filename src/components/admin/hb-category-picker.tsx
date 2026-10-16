"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";
import { searchHepsiburadaCategories } from "@/app/admin/(protected)/integrations/hepsiburada/actions";

type HbCat = { categoryId: string | number; name: string; paths?: string[]; leaf?: boolean };

/**
 * HB kategorisini ADIYLA arayıp seçme (önceden ürün satırında sadece ID yazılabiliyordu).
 * Ürün sadece en alt (leaf) kategoriye açılabildiği için üst kategoriler listede görünür ama seçilemez.
 */
export function HbCategoryPicker({
    onPick,
    placeholder = "HB kategorisi ara (ör. elcik)...",
    className = "",
    autoFocus = false,
}: {
    onPick: (id: string, name: string) => void;
    placeholder?: string;
    className?: string;
    autoFocus?: boolean;
}) {
    const [q, setQ] = useState("");
    const [results, setResults] = useState<HbCat[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const search = (v: string) => {
        setQ(v);
        setError("");
        if (v.trim().length < 2) {
            setResults([]);
            return;
        }
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(async () => {
            setLoading(true);
            try {
                const res: any = await searchHepsiburadaCategories(v.trim());
                if (res.success) setResults(res.data || []);
                else setError(res.message || "Kategoriler alınamadı.");
            } catch {
                setError("Bağlantı hatası.");
            } finally {
                setLoading(false);
            }
        }, 300);
    };

    return (
        <div className={`relative ${className}`}>
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
            <Input
                value={q}
                onChange={(e) => search(e.target.value)}
                placeholder={placeholder}
                className="h-8 pl-7 text-xs"
                autoFocus={autoFocus}
            />
            {loading && <Loader2 className="absolute right-2 top-2 h-3.5 w-3.5 animate-spin text-orange-500" />}
            {error && <p className="mt-1 text-[10px] text-red-500">{error}</p>}
            {results.length > 0 && (
                <div className="absolute z-50 mt-1 max-h-60 w-[min(420px,90vw)] overflow-y-auto rounded-md border border-orange-200 bg-white shadow-xl dark:bg-gray-800">
                    {results.map((c) => {
                        const isLeaf = c.leaf !== false;
                        return (
                            <button
                                key={String(c.categoryId)}
                                type="button"
                                disabled={!isLeaf}
                                onClick={() => {
                                    onPick(String(c.categoryId), c.name);
                                    setQ("");
                                    setResults([]);
                                }}
                                className={`flex w-full items-start justify-between gap-2 border-b border-gray-100 px-2.5 py-1.5 text-left last:border-0 dark:border-gray-700 ${isLeaf ? "hover:bg-orange-50 dark:hover:bg-orange-900/20" : "cursor-not-allowed opacity-50"}`}
                                title={isLeaf ? "" : "Üst kategori: ürün açılamaz, alt kategorisini seçin"}
                            >
                                <span className="flex flex-col">
                                    <span className="text-xs font-medium">{c.name}</span>
                                    {c.paths && c.paths.length > 0 && (
                                        <span className="text-[10px] italic text-gray-400 line-clamp-1">{c.paths.join(" > ")}</span>
                                    )}
                                    {!isLeaf && <span className="text-[10px] text-red-500">Üst kategori — alt kategorisini seçin</span>}
                                </span>
                                <span className="shrink-0 font-mono text-[10px] text-orange-600">#{String(c.categoryId)}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
