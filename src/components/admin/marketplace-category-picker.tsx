"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";

export type PickerMarketplace = "trendyol" | "n11" | "hepsiburada" | "idefix" | "pazarama" | "pttavm" | "ciceksepeti";

type Cat = { id: string; name: string; path?: string; leaf: boolean };

/** Pazaryeri kategori listesi (HB hariç) bir kez yüklenir, sayfa boyunca bellekte tutulur */
const listCache = new Map<PickerMarketplace, Promise<Cat[]>>();

/** "A > B" adlı bir kategori, "A > B > C" diye başlayan başka bir kategori varsa üst kategoridir (ürün açılamaz) */
function markLeaves(items: { id: string; name: string }[]): Cat[] {
    const names = items.map((i) => i.name);
    return items.map((i) => ({
        id: i.id,
        name: i.name,
        leaf: !names.some((n) => n !== i.name && n.startsWith(`${i.name} > `)),
    }));
}

function flattenTree(nodes: any[], prefix = ""): { id: string; name: string }[] {
    const out: { id: string; name: string }[] = [];
    for (const n of nodes || []) {
        if (!n || typeof n !== "object") continue;
        const id = String(n.id ?? n.categoryId ?? "");
        const raw = String(n.name ?? n.categoryName ?? "");
        const full = prefix ? `${prefix} > ${raw}` : raw;
        if (id && raw) out.push({ id, name: full });
        const kids = n.subCategories || n.categories || n.children || n.items;
        if (Array.isArray(kids)) out.push(...flattenTree(kids, full));
    }
    return out;
}

async function loadList(m: PickerMarketplace): Promise<Cat[]> {
    const norm = (arr: any[]) => (arr || []).map((c: any) => ({ id: String(c.id ?? c.categoryId), name: String(c.name ?? "") })).filter((c) => c.id && c.name);
    switch (m) {
        case "trendyol": {
            const { getTrendyolCategories } = await import("@/app/admin/(protected)/integrations/trendyol/actions");
            const r: any = await getTrendyolCategories();
            if (!r?.success) throw new Error(r?.message || "Trendyol kategorileri alınamadı.");
            return markLeaves(norm(r.data));
        }
        case "n11": {
            const { getFlatN11Categories } = await import("@/app/admin/(protected)/integrations/n11/actions");
            const r: any = await getFlatN11Categories();
            if (!r?.success) throw new Error(r?.message || "N11 kategorileri alınamadı.");
            return markLeaves(norm(r.categories));
        }
        case "idefix": {
            const { getIdefixCategories } = await import("@/app/admin/(protected)/integrations/idefix/actions");
            const r: any = await getIdefixCategories();
            if (!r?.success) throw new Error(r?.message || "Idefix kategorileri alınamadı.");
            return markLeaves(norm(r.data));
        }
        case "pazarama": {
            const { getPazaramaCategories } = await import("@/app/admin/(protected)/integrations/pazarama/actions");
            const r: any = await getPazaramaCategories();
            if (!r?.success) throw new Error(r?.message || "Pazarama kategorileri alınamadı.");
            return norm(r.data).map((c) => ({ ...c, leaf: true })); // zaten sadece ürün açılabilen kategoriler
        }
        case "pttavm": {
            const { getPttavmCategories } = await import("@/app/admin/(protected)/integrations/pttavm/actions");
            const r: any = await getPttavmCategories();
            if (!r?.success) throw new Error(r?.error || "ePttAVM kategorileri alınamadı.");
            return markLeaves(norm(r.data));
        }
        case "ciceksepeti": {
            const { getCiceksepetiCategories } = await import("@/app/admin/(protected)/integrations/ciceksepeti/actions");
            const cats: any = await getCiceksepetiCategories();
            const arr = Array.isArray(cats) ? cats : cats?.data || [];
            return markLeaves(flattenTree(arr));
        }
        default:
            return [];
    }
}

function getList(m: PickerMarketplace) {
    if (!listCache.has(m)) {
        const p = loadList(m).catch((e) => {
            listCache.delete(m); // hata olursa sonraki denemede tekrar yüklensin
            throw e;
        });
        listCache.set(m, p);
    }
    return listCache.get(m)!;
}

async function searchCats(m: PickerMarketplace, q: string): Promise<Cat[]> {
    if (m === "hepsiburada") {
        const { searchHepsiburadaCategories } = await import("@/app/admin/(protected)/integrations/hepsiburada/actions");
        const r: any = await searchHepsiburadaCategories(q);
        if (!r?.success) throw new Error(r?.message || "HB kategorileri alınamadı.");
        return (r.data || []).map((c: any) => ({
            id: String(c.categoryId),
            name: String(c.name),
            path: Array.isArray(c.paths) ? c.paths.join(" > ") : undefined,
            leaf: c.leaf !== false,
        }));
    }
    const all = await getList(m);
    const terms = q.toLocaleLowerCase("tr-TR").split(/\s+/).filter(Boolean);
    return all
        .filter((c) => {
            const s = `${c.name} ${c.id}`.toLocaleLowerCase("tr-TR");
            return terms.every((t) => s.includes(t));
        })
        .sort((a, b) => Number(b.leaf) - Number(a.leaf))
        .slice(0, 50);
}

/**
 * Pazaryeri kategorisini ADIYLA arayıp seçme (önceden ürün satırlarında sadece ID yazılabiliyordu).
 * Ürün sadece en alt kategoriye açılabildiği için üst kategoriler görünür ama seçilemez.
 */
export function MarketplaceCategoryPicker({
    marketplace,
    onPick,
    placeholder = "Kategoriyi adıyla ara...",
    className = "",
    autoFocus = false,
}: {
    marketplace: PickerMarketplace;
    onPick: (id: string, name: string) => void;
    placeholder?: string;
    className?: string;
    autoFocus?: boolean;
}) {
    const [q, setQ] = useState("");
    const [results, setResults] = useState<Cat[]>([]);
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
                setResults(await searchCats(marketplace, v.trim()));
            } catch (e: any) {
                setError(e?.message || "Kategoriler alınamadı.");
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
            {!loading && q.trim().length >= 2 && results.length === 0 && !error && (
                <p className="mt-1 text-[10px] text-gray-500">Sonuç yok.</p>
            )}
            {results.length > 0 && (
                <div className="absolute z-50 mt-1 max-h-60 w-[min(440px,90vw)] overflow-y-auto rounded-md border border-orange-200 bg-white shadow-xl dark:bg-gray-800">
                    {results.map((c) => (
                        <button
                            key={c.id}
                            type="button"
                            disabled={!c.leaf}
                            onClick={() => {
                                onPick(c.id, c.name);
                                setQ("");
                                setResults([]);
                            }}
                            className={`flex w-full items-start justify-between gap-2 border-b border-gray-100 px-2.5 py-1.5 text-left last:border-0 dark:border-gray-700 ${c.leaf ? "hover:bg-orange-50 dark:hover:bg-orange-900/20" : "cursor-not-allowed opacity-50"}`}
                            title={c.leaf ? "" : "Üst kategori: ürün açılamaz, alt kategorisini seçin"}
                        >
                            <span className="flex flex-col">
                                <span className="text-xs font-medium">{c.name}</span>
                                {c.path && <span className="text-[10px] italic text-gray-400 line-clamp-1">{c.path}</span>}
                                {!c.leaf && <span className="text-[10px] text-red-500">Üst kategori — alt kategorisini seçin</span>}
                            </span>
                            <span className="shrink-0 font-mono text-[10px] text-orange-600">#{c.id}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
