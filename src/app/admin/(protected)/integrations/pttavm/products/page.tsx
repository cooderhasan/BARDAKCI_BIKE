import { getPttavmProducts } from "../actions";
import { PttavmProductList } from "./pttavm-product-list";
import { ArrowLeft, Box } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface PttavmProductsPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    store?: string;
  }>;
}

export default async function PttavmProductsPage({ searchParams }: PttavmProductsPageProps) {
  const params = await searchParams;
  const page = Math.max(Number(params.page) || 1, 1);
  const search = params.search || "";
  const store = params.store || "ALL";

  const res = await getPttavmProducts({ page, limit: 50, search, store });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/integrations/pttavm">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-[#00A896]">
              <Box className="w-6 h-6 text-[#00A896]" />
              ePttAVM Ürün Yönetimi
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              ePttAVM pazaryerine ürün aktarımı ve stok/fiyat senkronizasyonu
            </p>
          </div>
        </div>
      </div>

      <PttavmProductList key={`${page}-${search}-${store}`} initialProducts={res.data || []} pagination={res.pagination} />
    </div>
  );
}
