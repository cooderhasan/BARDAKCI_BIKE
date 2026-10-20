"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { duplicateProduct } from "@/app/admin/(protected)/products/actions";

/** Ürünü kopyalar ve kopyanın düzenleme sayfasına gider (kopya pasif/taslak oluşur) */
export function useDuplicateProduct() {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const run = async (productId: string) => {
        if (busy) return;
        setBusy(true);
        try {
            const res = await duplicateProduct(productId);
            if (!res.success || !res.id) {
                toast.error(res.error || "Ürün kopyalanamadı.");
                return;
            }
            toast.success("Kopya oluşturuldu (pasif). Stok kodu, barkod, görsel ve stoğu düzenleyip aktif edin.", { duration: 8000 });
            router.push(`/admin/products/${res.id}/edit`);
        } finally {
            setBusy(false);
        }
    };
    return { run, busy };
}

export function DuplicateProductButton({ productId }: { productId: string }) {
    const { run, busy } = useDuplicateProduct();
    return (
        <Button type="button" variant="outline" onClick={() => run(productId)} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Copy className="h-4 w-4 mr-2" />}
            Bu Ürünü Kopyala
        </Button>
    );
}
