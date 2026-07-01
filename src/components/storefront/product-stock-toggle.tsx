"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from "next/navigation";

export function ProductStockToggle() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isInStockOnly = searchParams.get("in_stock") === "true";

    const handleCheckedChange = (checked: boolean) => {
        const params = new URLSearchParams(searchParams.toString());
        if (checked) {
            params.set("in_stock", "true");
        } else {
            params.delete("in_stock");
        }
        params.delete("page");
        router.push(`?${params.toString()}`);
    };

    return (
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 h-10 shadow-xs">
            <Switch
                id="header-in-stock-filter"
                checked={isInStockOnly}
                onCheckedChange={handleCheckedChange}
                className="data-[state=checked]:bg-[#17457C] scale-90"
            />
            <Label
                htmlFor="header-in-stock-filter"
                className="text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer select-none whitespace-nowrap"
            >
                Sadece Stoktakiler
            </Label>
        </div>
    );
}
