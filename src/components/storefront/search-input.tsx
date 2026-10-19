"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export function SearchInput() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [value, setValue] = useState(searchParams.get("search") || "");
    const [isPending, startTransition] = useTransition();

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();

        const params = new URLSearchParams(searchParams.toString());
        if (value) {
            params.set("search", value);
        } else {
            params.delete("search");
        }

        startTransition(() => {
            router.push(`/products?${params.toString()}`);
        });
    };

    return (
        // Açık gri dolgulu, odaklanınca beyaz + lacivert çerçeve; büyüteç düğmesi sağda
        <form onSubmit={handleSearch} className="relative w-full">
            <div className="flex items-center rounded-full bg-gray-100/90 dark:bg-gray-800 border border-transparent hover:bg-gray-100 dark:hover:bg-gray-800 focus-within:bg-white dark:focus-within:bg-gray-900 focus-within:border-[#17457C] focus-within:ring-4 focus-within:ring-[#17457C]/10 transition-all duration-200 pl-5 pr-1.5 py-1">
                <Input
                    type="search"
                    aria-label="Arama"
                    placeholder="Ürün, marka veya model ara..."
                    className="flex-1 min-w-0 border-0 shadow-none bg-transparent dark:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-[15px] h-10 md:h-11 px-0 placeholder:text-gray-500"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
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
        </form>
    );
}
