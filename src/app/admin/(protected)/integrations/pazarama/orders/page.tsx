import { getPazaramaOrders } from "../actions";
import { PazaramaOrderList } from "./pazarama-order-list";
import { PazaramaOrderSyncButton } from "../pazarama-order-sync-button";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function PazaramaOrdersPage() {
  const { data: orders } = await getPazaramaOrders();

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
              <ShoppingCart className="w-6 h-6 text-[#D81B60]" />
              Pazarama Siparişleri
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Son 1 ayın Pazarama siparişleri
            </p>
          </div>
        </div>
        <PazaramaOrderSyncButton variant="button" />
      </div>

      <PazaramaOrderList initialOrders={orders || []} />
    </div>
  );
}
