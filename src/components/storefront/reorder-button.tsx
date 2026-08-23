"use client";

import { Button } from "@/components/ui/button";
import { useCartStore } from "@/stores/cart-store";
import { getReorderItems } from "@/app/(storefront)/orders/actions";
import { toast } from "sonner";
import { RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface ReorderButtonProps {
    orderId: string;
}

export function ReorderButton({ orderId }: ReorderButtonProps) {
    const addItem = useCartStore((state) => state.addItem);
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleReorder = async () => {
        setLoading(true);
        try {
            const items = await getReorderItems(orderId);

            if (items.length === 0) {
                toast.error("Bu siparişteki ürünler artık stokta yok veya satışta değil.");
                return;
            }

            let addedCount = 0;
            items.forEach((item) => {
                if (item) {
                    addItem({
                        productId: item.productId,
                        name: item.name,
                        slug: item.slug,
                        listPrice: item.price, // Map price from action to listPrice in store
                        salePrice: item.salePrice, // Pass salePrice
                        image: item.image,
                        quantity: item.quantity,
                        vatRate: item.vatRate,
                        stock: item.stock,
                        discountRate: 0, // Default for reorder
                        minQuantity: item.minQuantity, // Now available on item
                        desi: item.desi,
                        isFreeShipping: item.isFreeShipping,
                    });
                    addedCount++;
                }
            });

            toast.success(`${addedCount} ürün sepete eklendi.`);
            router.push("/cart");
        } catch (error) {
            console.error(error);
            toast.error("Tekrar sipariş oluşturulurken bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button onClick={handleReorder} disabled={loading} variant="outline" size="sm" className="gap-2">
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? "Ekleniyor..." : "Tekrar Sipariş Ver"}
        </Button>
    );
}
