"use client";

import { Button } from "@/components/ui/button";
import { RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function RefreshButton() {
    const router = useRouter();
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = () => {
        setIsRefreshing(true);
        router.refresh();
        
        // Simüle edilmiş bekleme (Next.js refresh bitince feedback vermek için)
        setTimeout(() => {
            setIsRefreshing(false);
            toast.success("Sorular güncellendi");
        }, 1000);
    };

    return (
        <Button 
            variant="outline" 
            className="gap-2" 
            onClick={handleRefresh}
            disabled={isRefreshing}
        >
            <RefreshCcw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Yenileniyor..." : "Yenile"}
        </Button>
    );
}
