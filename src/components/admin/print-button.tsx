"use client";

import { Button } from "@/components/ui/button";

export function PrintButton() {
    return (
        <Button
            onClick={() => window.print()}
            className="bg-[#17457C] text-white hover:bg-[#0f3460] font-semibold"
        >
            🖨️ Yazdır
        </Button>
    );
}
