"use client";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Filter } from "lucide-react";
import { ProductFilters } from "./product-filters";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";

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

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden flex items-center gap-2 border-dashed">
                    <Filter className="w-4 h-4" />
                    Filtrele
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:w-[400px] p-0 flex flex-col">
                <SheetHeader className="px-6 py-4 border-b shrink-0">
                    <SheetTitle className="text-left">Filtreler</SheetTitle>
                </SheetHeader>
                <ScrollArea className="flex-1 px-6 py-4">
                    <div className="pb-4">
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
                <div className="shrink-0 border-t px-6 py-4 bg-white dark:bg-gray-900">
                    <Button
                        className="w-full bg-[#17457C] hover:bg-[#0f3460] text-white font-bold h-12 text-base rounded-xl shadow-lg"
                        onClick={() => setOpen(false)}
                    >
                        Filtreleri Uygula
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
