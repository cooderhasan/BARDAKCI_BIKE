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

interface ProductFiltersProps {
    categories: { id: string; name: string; slug: string }[];
    brands: { id: string; name: string; slug: string }[];
    colors: string[];
    sizes: string[];
    activeCategorySlug?: string;
}

export function ProductFilters({
    categories,
    brands,
    colors,
    sizes,
    activeCategorySlug,
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
    };

    const isSelected = (key: string, value: string) => {
        return searchParams.getAll(key).includes(value);
    };

    return (
        <div className="space-y-1">
            <Accordion type="multiple" defaultValue={["categories", "brands", "price", "colors", "sizes"]} className="w-full">

                {/* Categories */}
                <AccordionItem value="categories" className="border-none">
                    <AccordionTrigger className="text-sm font-bold text-gray-900 dark:text-gray-100 hover:no-underline py-4">
                        Kategoriler
                    </AccordionTrigger>
                    <AccordionContent>
                        <ScrollArea className="h-[240px] w-full pr-3 relative">
                            <div className="space-y-1">
                                <button
                                    onClick={() => router.push("/products")}
                                    className={cn(
                                        "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                                        !activeCategorySlug && !searchParams.get("category")
                                            ? "bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/20 dark:text-[#17457C]"
                                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                                    )}
                                >
                                    Tüm Kategoriler
                                </button>
                                {categories.map((category) => (
                                    <button
                                        key={category.id}
                                        onClick={() => router.push(`/category/${category.slug}`)}
                                        className={cn(
                                            "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                                            activeCategorySlug === category.slug || searchParams.get("category") === category.slug
                                                ? "bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/20 dark:text-[#17457C]"
                                                : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                                        )}
                                    >
                                        {category.name}
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </AccordionContent>
                </AccordionItem>

                {/* Brands */}
                {brands.length > 0 && (
                    <AccordionItem value="brands" className="border-t border-gray-100 dark:border-gray-800">
                        <AccordionTrigger className="text-sm font-bold text-gray-900 dark:text-gray-100 hover:no-underline py-4">
                            Markalar
                        </AccordionTrigger>
                        <AccordionContent>
                            <ScrollArea className="h-[200px] w-full pr-3">
                                <div className="space-y-3 pt-1">
                                    {brands.map((brand) => (
                                        <div key={brand.id} className="flex items-center space-x-3 group">
                                            <Checkbox
                                                id={`brand-${brand.id}`}
                                                checked={isSelected("brands", brand.slug)}
                                                onCheckedChange={() => toggleFilter("brands", brand.slug)}
                                                className="data-[state=checked]:bg-[#17457C] data-[state=checked]:border-[#17457C]"
                                            />
                                            <Label
                                                htmlFor={`brand-${brand.id}`}
                                                className="cursor-pointer text-sm font-normal text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors"
                                            >
                                                {brand.name}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </AccordionContent>
                    </AccordionItem>
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
                        <AccordionTrigger className="text-sm font-bold text-gray-900 dark:text-gray-100 hover:no-underline py-4">
                            Renkler
                        </AccordionTrigger>
                        <AccordionContent>
                            <ScrollArea className="h-[180px] w-full pr-1">
                                <div className="grid grid-cols-5 gap-2 pt-1">
                                    {colors.map((color) => (
                                        <button
                                            key={color}
                                            onClick={() => toggleFilter("colors", color)}
                                            className="group flex flex-col items-center gap-1.5 focus:outline-hidden"
                                            title={color}
                                        >
                                            <div
                                                className={cn(
                                                    "w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 transition-all relative",
                                                    isSelected("colors", color)
                                                        ? "ring-2 ring-[#17457C] ring-offset-2 dark:ring-offset-gray-900 scale-110"
                                                        : "hover:scale-110 hover:border-gray-400"
                                                )}
                                                style={{ backgroundColor: mapColorToCss(color) }}
                                            />
                                            <span className={cn(
                                                "text-[10px] text-center w-full truncate px-0.5",
                                                isSelected("colors", color) ? "text-[#17457C] font-medium" : "text-gray-500"
                                            )}>
                                                {color}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </ScrollArea>
                        </AccordionContent>
                    </AccordionItem>
                )}

                {/* Sizes */}
                {sizes.length > 0 && (
                    <AccordionItem value="sizes" className="border-t border-gray-100 dark:border-gray-800">
                        <AccordionTrigger className="text-sm font-bold text-gray-900 dark:text-gray-100 hover:no-underline py-4">
                            Bedenler
                        </AccordionTrigger>
                        <AccordionContent>
                            <ScrollArea className="h-[160px] w-full pr-1">
                                <div className="flex flex-wrap gap-2 pt-1">
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
                            </ScrollArea>
                        </AccordionContent>
                    </AccordionItem>
                )}
            </Accordion>
        </div>
    );
}

// Helper to map standard colors to CSS values
function mapColorToCss(colorName: string): string {
    const map: Record<string, string> = {
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
    };
    return map[colorName] || colorName;
}
