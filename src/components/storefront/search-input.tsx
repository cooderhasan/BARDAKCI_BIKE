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
        <form onSubmit={handleSearch} className="relative w-full max-w-2xl mx-auto">
            <div className="flex items-center bg-white dark:bg-gray-800 rounded-full shadow-sm hover:shadow-md transition-shadow duration-300 border border-gray-200/60 dark:border-gray-700/60 focus-within:border-[#17457C] focus-within:ring-4 focus-within:ring-[#17457C]/10 overflow-hidden pl-5 pr-1 py-1">
                <div className="text-gray-400">
                    {isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin text-[#17457C]" />
                    ) : (
                        <Search className="h-5 w-5" />
                    )}
                </div>
                <Input
                    type="search"
                    placeholder="Aradığınız ürün, kategori veya marka..."
                    className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm h-12 px-4 placeholder:text-gray-400"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                />
                <Button
                    type="submit"
                    size="sm"
                    className="rounded-full px-6 bg-[#17457C] hover:bg-[#0f3460] text-white shadow-md hover:shadow-lg transition-all"
                    disabled={isPending}
                >
                    Ara
                </Button>
            </div>
        </form>
    );
}

