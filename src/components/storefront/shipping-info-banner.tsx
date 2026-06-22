"use client";

import { Truck, Info } from "lucide-react";
import { getNextShippingDay } from "@/lib/shipping";
import { useEffect, useState } from "react";

export function ShippingInfoBanner() {
    const [shippingDay, setShippingDay] = useState<string>("");

    useEffect(() => {
        setShippingDay(getNextShippingDay());
        // Optional: Update every minute to handle cutoff
        const interval = setInterval(() => {
            setShippingDay(getNextShippingDay());
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    if (!shippingDay) return null;

    return (
        <div className="relative group overflow-hidden rounded-xl bg-gradient-to-br from-[#17457C] via-[#123c6e] to-[#0f3460] p-4 text-white shadow-md transition-all hover:shadow-lg mb-6">
            {/* Background pattern/glass effect */}
            <div className="absolute top-0 right-0 -mr-6 -mt-6 h-24 w-24 rounded-full bg-white/10 blur-2xl group-hover:bg-white/20 transition-all"></div>
            <div className="absolute bottom-0 left-0 -ml-6 -mb-6 h-16 w-16 rounded-full bg-black/5 blur-xl"></div>

            <div className="relative flex items-center gap-4">
                {/* Icon Container */}
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm border border-white/20 shadow-inner shrink-0">
                    <Truck className="h-6 w-6 text-white" />
                </div>

                {/* Text Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] font-black uppercase tracking-[0.1em] text-white/90">
                            BUGÜN SİPARİŞ VER
                        </span>
                        <div className="h-0.5 w-12 bg-white/40 rounded-full"></div>
                    </div>
                    
                    <h3 className="text-lg sm:text-xl font-black text-white leading-tight drop-shadow-sm">
                        {shippingDay} Kargoda
                    </h3>
                    
                    <div className="flex items-start gap-1.5 mt-1.5 pt-1.5 border-t border-white/10">
                        <Info className="h-3 w-3 text-white/70 shrink-0 mt-0.5" />
                        <p className="text-[10px] leading-relaxed text-white/80 font-medium">
                            Kargo firmasına bağlı teslimat süresi. Takip numarası ile kolay süreç.
                        </p>
                    </div>
                </div>
            </div>
            
            {/* Interactive Shine Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
        </div>
    );
}

