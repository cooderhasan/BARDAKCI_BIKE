"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// Turkish title casing helper to fix ALL CAPS database entries
function toTitleCaseTurkish(text: string): string {
    return text
        .split(" ")
        .map((word) => {
            if (!word) return "";
            const first = word.charAt(0).toLocaleLowerCase("tr-TR") === "ı" ? "I" : word.charAt(0).toLocaleUpperCase("tr-TR");
            const rest = word.slice(1).toLocaleLowerCase("tr-TR");
            return first + rest;
        })
        .join(" ");
}

interface ProductFiltersProps {
    categories: { id: string; name: string; slug: string }[];
    /** count: o listede (kategori/mağaza) markanın ürün sayısı; varsa çoktan aza sıralanır */
    brands: { id: string; name: string; slug: string; count?: number }[];
    colors: string[];
    sizes: string[];
    activeCategorySlug?: string;
    isMotor?: boolean;
    onFilterApply?: () => void;
}

export function ProductFilters({
    categories,
    brands,
    colors,
    sizes,
    activeCategorySlug,
    isMotor = false,
    onFilterApply,
}: ProductFiltersProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Local state for price inputs
    const [priceRange, setPriceRange] = useState({
        min: searchParams.get("min_price") || "",
        max: searchParams.get("max_price") || "",
    });

    const toggleFilter = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        const current = params.getAll(key);

        if (current.includes(value)) {
            const newValues = current.filter((v) => v !== value);
            params.delete(key);
            newValues.forEach((v) => params.append(key, v));
        } else {
            params.append(key, value);
        }

        // Reset page when filtering
        params.delete("page");

        router.push(`?${params.toString()}`);
    };

    const handlePriceFilter = () => {
        const params = new URLSearchParams(searchParams.toString());
        if (priceRange.min) params.set("min_price", priceRange.min);
        else params.delete("min_price");

        if (priceRange.max) params.set("max_price", priceRange.max);
        else params.delete("max_price");

        params.delete("page");

        router.push(`?${params.toString()}`);
        onFilterApply?.();
    };

    const isSelected = (key: string, value: string) => {
        return searchParams.getAll(key).includes(value);
    };

    return (
        <div className="space-y-1">
            <Accordion type="multiple" defaultValue={["categories", "brands", "genders", "brakes", "price", "colors", "sizes"]} className="w-full">

                {/* Categories */}
                <AccordionItem value="categories" className="border-none">
                    <AccordionTrigger className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:no-underline py-3">
                        Kategoriler
                    </AccordionTrigger>
                    <AccordionContent>
                        <div className="space-y-1 pr-1">
                            <button
                                onClick={() => { router.push("/products"); onFilterApply?.(); }}
                                className={cn(
                                    "w-full text-left px-3 py-1.5 rounded-lg text-sm transition-all duration-200 cursor-pointer",
                                    !activeCategorySlug && !searchParams.get("category")
                                        ? "text-[#17457C] font-semibold bg-blue-50/60 dark:bg-blue-950/30"
                                        : "text-gray-600 dark:text-gray-400 hover:text-[#17457C] hover:bg-gray-50/50 dark:hover:bg-gray-800/40"
                                )}
                            >
                                Tüm Kategoriler
                            </button>
                            {categories.map((category) => (
                                <button
                                    key={category.id}
                                    onClick={() => { router.push(`/category/${category.slug}`); onFilterApply?.(); }}
                                    className={cn(
                                        "w-full text-left px-3 py-1.5 rounded-lg text-sm transition-all duration-200 cursor-pointer",
                                        activeCategorySlug === category.slug || searchParams.get("category") === category.slug
                                            ? "text-[#17457C] font-semibold bg-blue-50/60 dark:bg-blue-950/30"
                                            : "text-gray-600 dark:text-gray-400 hover:text-[#17457C] hover:bg-gray-50/50 dark:hover:bg-gray-800/40"
                                    )}
                                >
                                    {toTitleCaseTurkish(category.name)}
                                </button>
                            ))}
                        </div>
                    </AccordionContent>
                </AccordionItem>

                {/* Brands: uzun listede ilk 8 + "Tümünü göster" ve arama (motor yedek parçada 33 marka alt alta çıkıyordu) */}
                {brands.length > 0 && (
                    <AccordionItem value="brands" className="border-t border-gray-100 dark:border-gray-800">
                        <AccordionTrigger className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:no-underline py-3">
                            Markalar
                        </AccordionTrigger>
                        <AccordionContent>
                            <BrandFilterList
                                brands={brands}
                                isSelected={(slug) => isSelected("brands", slug)}
                                onToggle={(slug) => toggleFilter("brands", slug)}
                            />
                        </AccordionContent>
                    </AccordionItem>
                )}

                {!isMotor && (
                    <>
                        {/* Cinsiyet */}
                        <AccordionItem value="genders" className="border-t border-gray-100 dark:border-gray-800">
                            <AccordionTrigger className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:no-underline py-3">
                                Cinsiyet
                            </AccordionTrigger>
                            <AccordionContent>
                                <div className="space-y-2.5 pt-1 pr-1">
                                    {[
                                        { label: "Erkek", value: "Erkek" },
                                        { label: "Kadın", value: "Kadın" },
                                        { label: "Unisex", value: "Unisex" }
                                    ].map((gender) => (
                                        <div key={gender.value} className="flex items-center space-x-3 group">
                                            <Checkbox
                                                id={`gender-${gender.value}`}
                                                checked={isSelected("genders", gender.value)}
                                                onCheckedChange={() => toggleFilter("genders", gender.value)}
                                                className="data-[state=checked]:bg-[#17457C] data-[state=checked]:border-[#17457C]"
                                            />
                                            <Label
                                                htmlFor={`gender-${gender.value}`}
                                                className="cursor-pointer text-sm font-normal text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors"
                                            >
                                                {gender.label}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        {/* Fren */}
                        <AccordionItem value="brakes" className="border-t border-gray-100 dark:border-gray-800">
                            <AccordionTrigger className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:no-underline py-3">
                                Fren
                            </AccordionTrigger>
                            <AccordionContent>
                                <div className="space-y-2.5 pt-1 pr-1">
                                    {[
                                        { label: "V FREN", value: "V FREN" },
                                        { label: "MEKANİK DİSK FREN", value: "Mekanik Disk Fren" },
                                        { label: "HİDROLİK DİSK FREN", value: "Hidrolik Disk Fren" }
                                    ].map((brake) => (
                                        <div key={brake.value} className="flex items-center space-x-3 group">
                                            <Checkbox
                                                id={`brake-${brake.value}`}
                                                checked={isSelected("brakes", brake.value)}
                                                onCheckedChange={() => toggleFilter("brakes", brake.value)}
                                                className="data-[state=checked]:bg-[#17457C] data-[state=checked]:border-[#17457C]"
                                            />
                                            <Label
                                                htmlFor={`brake-${brake.value}`}
                                                className="cursor-pointer text-sm font-normal text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors"
                                            >
                                                {brake.label}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </>
                )}

                {/* Price Range */}
                <AccordionItem value="price" className="border-t border-gray-100 dark:border-gray-800">
                    <AccordionTrigger className="text-sm font-bold text-gray-900 dark:text-gray-100 hover:no-underline py-4">
                        Fiyat Aralığı
                    </AccordionTrigger>
                    <AccordionContent>
                        <div className="space-y-4 pt-1 pr-1">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-400">En Az</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₺</span>
                                        <Input
                                            type="number"
                                            value={priceRange.min}
                                            onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                                            className="pl-7 h-9 text-sm"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-400">En Çok</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₺</span>
                                        <Input
                                            type="number"
                                            value={priceRange.max}
                                            onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                                            className="pl-7 h-9 text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                            <Button
                                className="w-full bg-gray-900 hover:bg-[#17457C] text-white h-9 text-sm transition-colors"
                                onClick={handlePriceFilter}
                            >
                                Uygula
                            </Button>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                {/* Colors */}
                {colors.length > 0 && (
                    <AccordionItem value="colors" className="border-t border-gray-100 dark:border-gray-800">
                        <AccordionTrigger className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:no-underline py-3">
                            Renkler
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="grid grid-cols-4 gap-x-2 gap-y-3 pt-1 pr-1">
                                {colors.map((color) => (
                                    <button
                                        key={color}
                                        onClick={() => toggleFilter("colors", color)}
                                        className="group flex flex-col items-center gap-1.5 focus:outline-hidden"
                                        title={color}
                                    >
                                        <div
                                            className={cn(
                                                "w-7 h-7 rounded-full border border-gray-200 dark:border-gray-700 transition-all relative",
                                                isSelected("colors", color)
                                                    ? "ring-2 ring-[#17457C] ring-offset-2 dark:ring-offset-gray-900 scale-110"
                                                    : "hover:scale-110 hover:border-gray-400"
                                            )}
                                            style={{ background: colorSwatchCss(color) }}
                                        />
                                        <span className={cn(
                                            "text-[10px] text-center w-full leading-tight line-clamp-2 break-words px-0.5",
                                            isSelected("colors", color) ? "text-[#17457C] font-medium" : "text-gray-500"
                                        )}>
                                            {color}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                )}

                {/* Sizes */}
                {sizes.length > 0 && (
                    <AccordionItem value="sizes" className="border-t border-gray-100 dark:border-gray-800">
                        <AccordionTrigger className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:no-underline py-3">
                            Bedenler
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="flex flex-wrap gap-2 pt-1 pr-1">
                                {sizes.map((size) => (
                                    <button
                                        key={size}
                                        onClick={() => toggleFilter("sizes", size)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg text-sm font-medium border transition-all",
                                            isSelected("sizes", size)
                                                ? "bg-[#17457C] text-white border-[#17457C] shadow-sm"
                                                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-[#17457C] hover:text-[#17457C]"
                                        )}
                                    >
                                        {size}
                                    </button>
                                ))}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                )}
            </Accordion>
        </div>
    );
}

// "Siyah / Mavi" gibi çok renkli değerler yarım yarım iki renkli yuvarlak; bilinmeyen renk gri
// (önceden bilinmeyen değer beyaz/boş daire görünüyordu)
function colorSwatchCss(colorName: string): string {
    const parts = colorName.split(/\s*[\/,-]\s*/).map((p) => p.trim()).filter(Boolean);
    const cssOf = (n: string) => {
        const key = Object.keys(COLOR_MAP).find((k) => k.toLocaleLowerCase("tr-TR") === n.toLocaleLowerCase("tr-TR"));
        return key ? COLOR_MAP[key] : null;
    };
    const known = parts.map(cssOf).filter(Boolean) as string[];
    if (known.length >= 2) return `linear-gradient(135deg, ${known[0]} 50%, ${known[1]} 50%)`;
    if (known.length === 1) return known[0];
    return "#D1D5DB";
}

const COLOR_MAP: Record<string, string> = {
        "Kırmızı": "#EF4444",
        "Mavi": "#3B82F6",
        "Yeşil": "#22C55E",
        "Sarı": "#EAB308",
        "Siyah": "#171717",
        "Beyaz": "#FFFFFF",
        "Turuncu": "#F97316",
        "Mor": "#A855F7",
        "Pembe": "#EC4899",
        "Gri": "#6B7280",
        "Lacivert": "#1E3A8A",
        "Bordo": "#7F1D1D",
        "Bej": "#F5F5DC",
        "Kahverengi": "#78350F",
        "Turkuaz": "#14B8A6",
        "Gold": "#FFD700",
        "Gümüş": "#C0C0C0",
        "Antrasit": "#374151",
        "Krem": "#FFFDD0",
        "Haki": "#4a5d23",
        "Vişne": "#800000",
        "Pudra": "#E8BFB9",
        "Füme": "#4B5563",
        "Fuşya": "#D946EF",
        "Mint": "#6EE7B7",
};

const BRAND_PREVIEW = 8;

function BrandFilterList({
    brands,
    isSelected,
    onToggle,
}: {
    brands: { id: string; name: string; slug: string; count?: number }[];
    isSelected: (slug: string) => boolean;
    onToggle: (slug: string) => void;
}) {
    const [showAll, setShowAll] = useState(false);
    const [query, setQuery] = useState("");
    // Çok ürünü olan marka üstte; seçili markalar her zaman görünür
    const sorted = [...brands].sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.name.localeCompare(b.name, "tr"));
    const q = query.trim().toLocaleLowerCase("tr-TR");
    const matched = q ? sorted.filter((b) => b.name.toLocaleLowerCase("tr-TR").includes(q)) : sorted;
    let visible = showAll || q ? matched : matched.slice(0, BRAND_PREVIEW);
    const hiddenSelected = matched.filter((b) => isSelected(b.slug) && !visible.includes(b));
    visible = [...visible, ...hiddenSelected];
    const hasMore = !q && !showAll && matched.length > BRAND_PREVIEW;

    return (
        <div className="space-y-2.5 pt-1 pr-1">
            {brands.length > BRAND_PREVIEW && (
                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Marka ara..."
                    className="h-8 text-sm"
                />
            )}
            {visible.map((brand) => (
                <div key={brand.id} className="flex items-center space-x-3 group">
                    <Checkbox
                        id={`brand-${brand.id}`}
                        checked={isSelected(brand.slug)}
                        onCheckedChange={() => onToggle(brand.slug)}
                        className="data-[state=checked]:bg-[#17457C] data-[state=checked]:border-[#17457C]"
                    />
                    <Label
                        htmlFor={`brand-${brand.id}`}
                        className="flex-1 flex items-center justify-between gap-2 cursor-pointer text-sm font-normal text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors"
                    >
                        <span className="truncate">{brand.name}</span>
                        {typeof brand.count === "number" && <span className="text-xs text-gray-400 shrink-0">{brand.count}</span>}
                    </Label>
                </div>
            ))}
            {q && matched.length === 0 && <p className="text-xs text-gray-400">Marka bulunamadı.</p>}
            {hasMore && (
                <button type="button" onClick={() => setShowAll(true)} className="text-xs font-semibold text-[#17457C] hover:underline">
                    Tümünü göster ({matched.length})
                </button>
            )}
            {showAll && !q && brands.length > BRAND_PREVIEW && (
                <button type="button" onClick={() => setShowAll(false)} className="text-xs font-semibold text-gray-500 hover:underline">
                    Daha az göster
                </button>
            )}
        </div>
    );
}
