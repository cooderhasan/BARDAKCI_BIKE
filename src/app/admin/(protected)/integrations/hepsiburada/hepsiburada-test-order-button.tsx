"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Loader2 } from "lucide-react";
import { createHepsiburadaTestOrder } from "./actions";
import { toast } from "sonner";

export function HepsiburadaTestOrderButton() {
    const [loading, setLoading] = useState(false);

    const handleCreateOrder = async () => {
        if (!confirm("Hepsiburada SIT (Test) ortamında hayali bir sipariş oluşturulacak. Emin misiniz?")) return;

        setLoading(true);
        try {
            const res = await createHepsiburadaTestOrder();
            if (res.success) {
                toast.success(res.message);
            } else {
                toast.error(res.message);
            }
        } catch (error) {
            toast.error("İşlem sırasında bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="rounded-lg border bg-orange-50 border-orange-200 text-orange-900 shadow-sm p-6">
            <h3 className="font-semibold leading-none tracking-tight mb-4 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                SIT Test Siparişi
            </h3>
            <p className="text-sm text-orange-800 mb-4">
                Hepsiburada SIT (Test) entegrasyonu için zorunlu olan "Sipariş Oluşturma" adımını bu butona basarak yapabilirsiniz.
            </p>

            <Button 
                onClick={handleCreateOrder}
                disabled={loading}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white gap-2 shadow-lg shadow-orange-500/20"
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                Test Siparişi Oluştur
            </Button>
            <p className="text-[10px] mt-2 text-orange-600 italic text-center">
                * Bu işlem sadece Test Modu aktifse çalışır.
            </p>
        </div>
    );
}
