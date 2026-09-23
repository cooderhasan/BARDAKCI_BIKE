"use client";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Filter } from "lucide-react";
import { ProductFilters } from "./product-filters";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

interface MobileProductFiltersProps {
    categories: { id: string; name: string; slug: string }[];
    brands: { id: string; name: string; slug: string }[];
    colors: string[];
    sizes: string[];
    activeCategorySlug?: string;
    isMotor?: boolean;
}

export function MobileProductFilters({
    categories,
    brands,
    colors,
    sizes,
    activeCategorySlug,
    isMotor,
}: MobileProductFiltersProps) {
    const [open, setOpen] = useState(false);
    const searchParams = useSearchParams();

    const activeFiltersCount = ["brand", "gender", "brake_type", "color", "size"].reduce(
        (acc, key) => acc + searchParams.getAll(key).length,
        0
    ) + (searchParams.get("min_price") || searchParams.get("max_price") ? 1 : 0);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="lg:hidden flex items-center gap-2 rounded-xl h-10 px-3.5 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 font-semibold text-xs text-gray-700 dark:text-gray-200 shadow-xs hover:border-[#17457C]"
                >
                    <Filter className="w-3.5 h-3.5 text-[#17457C]" />
                    <span>Filtrele</span>
                    {activeFiltersCount > 0 && (
                        <span className="flex items-center justify-center min-w-5 h-5 px-1.5 text-[11px] font-bold text-white bg-[#17457C] rounded-full">
                            {activeFiltersCount}
                        </span>
                    )}
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:w-[400px] p-0">
                <SheetHeader className="px-6 py-4 border-b">
                    <SheetTitle className="text-left">Filtreler</SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-80px)] px-6 py-4">
                    <div className="pb-24">
                    <ProductFilters
                        categories={categories}
                        brands={brands}
                        colors={colors}
                        sizes={sizes}
                        activeCategorySlug={activeCategorySlug}
                        isMotor={isMotor}
                        onFilterApply={() => setTimeout(() => setOpen(false), 300)}
                    />
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}
