import { getCiceksepetiProducts } from "../actions";
import { CiceksepetiProductList } from "./ciceksepeti-product-list";
import { ArrowLeft, Box } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function CiceksepetiProductsPage() {
  const products = await getCiceksepetiProducts();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/integrations/ciceksepeti">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-rose-700 dark:text-rose-400">
              <Box className="w-6 h-6 text-rose-600" />
              Çiçeksepeti Ürün Yönetimi
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Çiçeksepeti pazar yerine özel ürün aktarımı ve fiyat/stok senkronizasyonu
            </p>
          </div>
        </div>
      </div>

      <CiceksepetiProductList initialProducts={products || []} />
    </div>
  );
}
