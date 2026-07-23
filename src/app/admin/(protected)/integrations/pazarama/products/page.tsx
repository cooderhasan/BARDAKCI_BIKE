import { getPazaramaProducts } from "../actions";
import { PazaramaProductList } from "./pazarama-product-list";
import { ArrowLeft, Box } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function PazaramaProductsPage() {
  const { data: products } = await getPazaramaProducts();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/integrations/pazarama">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Box className="w-6 h-6 text-[#D81B60]" />
              Pazarama Ürün Yönetimi
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pazarama pazar yerine ürün aktarımı ve stok/fiyat senkronizasyonu
            </p>
          </div>
        </div>
      </div>

      <PazaramaProductList initialProducts={products || []} />
    </div>
  );
}
