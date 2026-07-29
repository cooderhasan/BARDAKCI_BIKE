"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useState, useEffect } from "react";

interface MarketplacePaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit?: number;
}

export function MarketplacePagination({ currentPage, totalPages, totalCount, limit = 50 }: MarketplacePaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const storeParam = searchParams.get("store") || "ALL";

  useEffect(() => {
    setSearchTerm(searchParams.get("search") || "");
  }, [searchParams]);

  const updateQueryParams = (newParams: Record<string, string | number | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([key, value]) => {
      if (value === null || value === "" || value === "ALL") {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateQueryParams({ search: searchTerm, page: 1 });
  };

  const handleStoreChange = (val: string) => {
    updateQueryParams({ store: val, page: 1 });
  };

  const startItem = totalCount > 0 ? Math.min((currentPage - 1) * limit + 1, totalCount) : 0;
  const endItem = Math.min(currentPage * limit, totalCount);

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ürün adı, SKU veya barkod ile ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm" className="h-9">
            Ara
          </Button>
        </form>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <div className="w-48">
            <Select value={storeParam} onValueChange={handleStoreChange}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Mağaza Seç" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tüm Mağazalar</SelectItem>
                <SelectItem value="MOTOR">Motovitrin (Motor)</SelectItem>
                <SelectItem value="BIKE">Bardakçı Bike (Bisiklet)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Pagination Controls Footer */}
      {totalPages > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-card rounded-xl border text-sm text-muted-foreground shadow-sm">
          <div>
            Toplam <strong className="text-foreground">{totalCount.toLocaleString("tr-TR")}</strong> üründen{" "}
            <strong className="text-foreground">{startItem} - {endItem}</strong> arası gösteriliyor. Sayfa <strong className="text-foreground">{currentPage}</strong> / <strong className="text-foreground">{totalPages}</strong>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateQueryParams({ page: currentPage - 1 })}
              disabled={currentPage <= 1}
              className="h-8"
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Önceki
            </Button>

            <span className="px-3 text-xs font-semibold text-foreground">
              {currentPage} / {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => updateQueryParams({ page: currentPage + 1 })}
              disabled={currentPage >= totalPages}
              className="h-8"
            >
              Sonraki <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
