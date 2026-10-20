"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, ArrowRight, FolderOpen } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { formatPrice } from "@/lib/helpers";

interface SuggestProduct {
    id: string;
    name: string;
    slug: string;
    image: string | null;
    price: number;
    oldPrice: number | null;
    inStock: boolean;
}
interface SuggestResult {
    products: SuggestProduct[];
    categories: { name: string; slug: string }[];
    total: number;
}

const toTitle = (t: string) => t.toLocaleLowerCase("tr-TR").replace(/(?:^|[\s-/])\S/g, (m) => m.toLocaleUpperCase("tr-TR"));

export function SearchInput() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const [value, setValue] = useState(searchParams.get("search") || "");
    const [isPending, startTransition] = useTransition();

    // Sayfa değişince: arama sonuçlarında aranan kelime kutuda kalır (düzeltmek için), başka sayfada kutu temizlenir.
    // Önceden header yeniden yüklenmediği için ürün/kategori sayfasına geçince de eski kelime kutuda kalıyordu.
    const urlSearch = searchParams.get("search") || "";
    useEffect(() => {
        setValue(pathname === "/products" ? urlSearch : "");
        setOpen(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, urlSearch]);

    // Canlı öneriler: yazarken ilk ürünler ve kategoriler (api/search/suggest)
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<SuggestResult | null>(null);
    const [active, setActive] = useState(-1);
    const boxRef = useRef<HTMLFormElement>(null);
    const reqId = useRef(0);

    useEffect(() => {
        const q = value.trim();
        if (q.length < 2) {
            setResult(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        const id = ++reqId.current;
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`);
                const data: SuggestResult = await res.json();
                if (id === reqId.current) {
                    setResult(data);
                    setActive(-1);
                }
            } catch {
                if (id === reqId.current) setResult(null);
            } finally {
                if (id === reqId.current) setLoading(false);
            }
        }, 250);
        return () => clearTimeout(t);
    }, [value]);

    // Dışarı tıklayınca kapat
    useEffect(() => {
        const onDown = (e: MouseEvent | TouchEvent) => {
            if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("touchstart", onDown);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("touchstart", onDown);
        };
    }, []);

    const goSearch = (q: string) => {
        setOpen(false);
        const params = new URLSearchParams(searchParams.toString());
        params.delete("page");
        if (q) params.set("search", q);
        else params.delete("search");
        startTransition(() => {
            router.push(`/products?${params.toString()}`);
        });
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const items = result?.products || [];
        if (open && active >= 0 && active < items.length) {
            setOpen(false);
            router.push(`/products/${items[active].slug}`);
            return;
        }
        goSearch(value.trim());
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const n = result?.products.length || 0;
        if (e.key === "Escape") {
            setOpen(false);
            return;
        }
        if (!n) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => (a + 1) % n);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a <= 0 ? n - 1 : a - 1));
        }
    };

    const q = value.trim();
    const showPanel = open && q.length >= 2 && (loading || result !== null);
    const hasResults = !!result && (result.products.length > 0 || result.categories.length > 0);

    return (
        // Açık gri dolgulu, odaklanınca beyaz + lacivert çerçeve; büyüteç düğmesi sağda
        <form ref={boxRef} onSubmit={handleSearch} className="relative w-full">
            <div className="flex items-center rounded-full bg-gray-100/90 dark:bg-gray-800 border border-transparent hover:bg-gray-100 dark:hover:bg-gray-800 focus-within:bg-white dark:focus-within:bg-gray-900 focus-within:border-[#17457C] focus-within:ring-4 focus-within:ring-[#17457C]/10 transition-all duration-200 pl-5 pr-1.5 py-1">
                <Input
                    type="search"
                    aria-label="Arama"
                    aria-autocomplete="list"
                    autoComplete="off"
                    placeholder="Ürün, marka veya model ara..."
                    className="flex-1 min-w-0 border-0 shadow-none bg-transparent dark:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-[15px] h-10 md:h-11 px-0 placeholder:text-gray-500"
                    value={value}
                    onChange={(e) => {
                        setValue(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={onKeyDown}
                />
                <Button
                    type="submit"
                    aria-label="Ara"
                    className="h-9 w-9 md:h-10 md:w-10 p-0 shrink-0 rounded-full bg-[#17457C] hover:bg-[#0f3460] text-white shadow-md shadow-[#17457C]/20 transition-all"
                    disabled={isPending}
                >
                    {isPending ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Search className="h-[18px] w-[18px]" />}
                </Button>
            </div>

            {showPanel && (
                <div className="absolute left-0 right-0 top-full mt-2 z-[60] rounded-2xl bg-white dark:bg-gray-900 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
                    {loading && !result && (
                        <div className="flex items-center gap-2 px-4 py-4 text-sm text-gray-500">
                            <Loader2 className="h-4 w-4 animate-spin" /> Aranıyor...
                        </div>
                    )}

                    {result && !hasResults && !loading && (
                        <div className="px-4 py-4 text-sm text-gray-500">
                            &quot;{q}&quot; için sonuç bulunamadı.
                        </div>
                    )}

                    {result && result.categories.length > 0 && (
                        <div className="px-2 pt-2">
                            {result.categories.map((c) => (
                                <button
                                    key={c.slug}
                                    type="button"
                                    onClick={() => {
                                        setOpen(false);
                                        router.push(`/category/${c.slug}`);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                                >
                                    <FolderOpen className="h-4 w-4 text-[#17457C] shrink-0" />
                                    <span className="truncate">{toTitle(c.name)}</span>
                                    <span className="ml-auto text-[11px] text-gray-400 shrink-0">Kategori</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {result && result.products.length > 0 && (
                        <ul className="p-2 max-h-[60vh] overflow-y-auto" role="listbox">
                            {result.products.map((p, i) => (
                                <li key={p.id} role="option" aria-selected={active === i}>
                                    <button
                                        type="button"
                                        onMouseEnter={() => setActive(i)}
                                        onClick={() => {
                                            setOpen(false);
                                            router.push(`/products/${p.slug}`);
                                        }}
                                        className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-colors ${active === i ? "bg-gray-50 dark:bg-gray-800" : ""}`}
                                    >
                                        <span className="relative w-12 h-12 shrink-0 rounded-lg bg-[#f3f5f8] dark:bg-gray-800 overflow-hidden">
                                            {p.image && (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={`/_next/image?url=${encodeURIComponent(p.image)}&w=96&q=75`}
                                                    alt=""
                                                    className="w-full h-full object-contain p-1 mix-blend-multiply dark:mix-blend-normal"
                                                    loading="lazy"
                                                />
                                            )}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm text-gray-800 dark:text-gray-100 leading-snug line-clamp-2">{p.name}</span>
                                            {!p.inStock && <span className="text-[11px] text-red-500 font-medium">Tükendi</span>}
                                        </span>
                                        <span className="shrink-0 text-right">
                                            {p.oldPrice && <span className="block text-[11px] text-gray-400 line-through">{formatPrice(p.oldPrice)}</span>}
                                            <span className="block text-sm font-bold text-[#17457C] dark:text-blue-300">{formatPrice(p.price)}</span>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    {result && result.total > 0 && (
                        <button
                            type="button"
                            onClick={() => goSearch(q)}
                            className="w-full flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-semibold text-[#17457C] dark:text-blue-300 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 border-t border-gray-100 dark:border-gray-800"
                        >
                            &quot;{q}&quot; için tüm sonuçları gör ({result.total})
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    )}
                </div>
            )}
        </form>
    );
}
