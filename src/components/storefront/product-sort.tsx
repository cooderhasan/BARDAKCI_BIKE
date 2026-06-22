"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter, useSearchParams } from "next/navigation";

interface ProductSortProps {
    initialSort: string;
}

export function ProductSort({ initialSort }: ProductSortProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const handleSortChange = (value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("sort", value);
        router.push(`?${params.toString()}`);
    };

    return (
        <Select defaultValue={initialSort} onValueChange={handleSortChange}>
            <SelectTrigger className="w-full sm:w-[180px] bg-white dark:bg-gray-800">
                <SelectValue placeholder="Sıralama" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="newest">En Yeniler</SelectItem>
                <SelectItem value="price_asc">Fiyat (Artan)</SelectItem>
                <SelectItem value="price_desc">Fiyat (Azalan)</SelectItem>
            </SelectContent>
        </Select>
    );
}
