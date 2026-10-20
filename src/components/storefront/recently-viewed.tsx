"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/helpers";

/**
 * Son görüntülenen ürünler: kimlikler müşterinin tarayıcısında (localStorage) tutulur; giriş gerekmez, sunucuya yük yok.
 * Bisiklet ve motor sitesi ayrı alan adı olduğu için listeleri de ayrı. Fiyat/stok gösterirken güncel alınır.
 */
const KEY = "recently_viewed_v1";
const MAX = 12;

function readIds(): string[] {
    try {
        const raw = localStorage.getItem(KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
    } catch {
        return [];
    }
}

/** Ürün sayfasında çağrılır: ürünü listenin başına ekler */
export function trackRecentlyViewed(productId: string) {
    try {
        const next = [productId, ...readIds().filter((id) => id !== productId)].slice(0, MAX);
        localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
        // tarayıcı depolaması kapalı olabilir; özellik sessizce çalışmaz
    }
}

interface RecentProduct {
    id: string;
    name: string;
    slug: string;
    image: string | null;
    price: number;
    oldPrice: number | null;
    inStock: boolean;
}

export function RecentlyViewed({ excludeId, className }: { excludeId?: string; className?: string }) {
    const [products, setProducts] = useState<RecentProduct[]>([]);

    useEffect(() => {
        const ids = readIds().filter((id) => id !== excludeId).slice(0, MAX);
        if (ids.length === 0) return;
        let cancelled = false;
        fetch(`/api/products/recent?ids=${ids.join(",")}`)
            .then((r) => r.json())
            .then((d) => {
                if (!cancelled) setProducts(Array.isArray(d?.products) ? d.products : []);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [excludeId]);

    if (products.length === 0) return null;

    return (
        <section className={className}>
            <div className="flex items-center gap-2 mb-1.5">
                <span className="h-px w-6 bg-[#17457C] dark:bg-blue-400" />
                <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.18em] text-[#17457C] dark:text-blue-400">
                    Kaldığınız Yerden
                </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-5">
                Son Görüntülenenler
            </h2>
            {/* Telefonda yana kaydırılır; geniş ekranda 6 sütun */}
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 lg:grid lg:grid-cols-6 lg:overflow-visible">
                {products.map((p) => (
                    <Link
                        key={p.id}
                        href={`/products/${p.slug}`}
                        className="group shrink-0 w-[42%] sm:w-[30%] lg:w-auto rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/60 dark:ring-gray-700 hover:shadow-[0_10px_28px_-8px_rgba(23,69,124,0.2)] transition-all duration-300 overflow-hidden"
                    >
                        <div className="relative aspect-square m-2 rounded-xl bg-[#f3f5f8] dark:bg-gray-900 overflow-hidden">
                            {p.image && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={`/_next/image?url=${encodeURIComponent(p.image)}&w=256&q=75`}
                                    alt={p.name}
                                    loading="lazy"
                                    className={`w-full h-full object-contain p-2 mix-blend-multiply dark:mix-blend-normal transition-transform duration-500 group-hover:scale-105 ${p.inStock ? "" : "opacity-50 grayscale"}`}
                                />
                            )}
                            {!p.inStock && (
                                <span className="absolute bottom-1.5 left-1.5 text-[10px] font-bold bg-gray-900 text-white px-2 py-0.5 rounded-full">Tükendi</span>
                            )}
                        </div>
                        <div className="px-3 pb-3">
                            <p className="text-[13px] font-medium text-gray-800 dark:text-gray-100 leading-snug line-clamp-2 min-h-[2.4rem] group-hover:text-[#17457C]">
                                {p.name}
                            </p>
                            <div className="mt-1">
                                {p.oldPrice && <span className="block text-[11px] text-gray-400 line-through leading-none">{formatPrice(p.oldPrice)}</span>}
                                <span className="text-sm font-extrabold text-gray-900 dark:text-white">{formatPrice(p.price)}</span>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    );
}
