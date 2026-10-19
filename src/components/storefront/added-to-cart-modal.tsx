"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useCartStore } from "@/stores/cart-store";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { Check, ShoppingCart, ArrowRight, X, Truck } from "lucide-react";
import { formatPrice } from "@/lib/helpers";

/**
 * "Sepete eklendi" penceresi. Site renklerinde (lacivert), sade ölçüler; telefonda alttan açılan panel.
 * "Sepete Git" gerçekten sepete gider (önceden doğrudan ödeme sayfasına gidiyordu); ödemeye geçiş ayrı bağlantı.
 */
export function AddedToCartModal() {
    const {
        isAddedToCartModalOpen,
        closeAddedToCartModal,
        lastAddedItem,
        isAuthenticated,
        items,
        getSummary,
    } = useCartStore();

    if (!lastAddedItem) return null;

    const summary = getSummary();
    const itemCount = items.reduce((n, it) => n + Number(it.quantity || 0), 0);
    const allFreeShipping = items.length > 0 && items.every((it) => it.isFreeShipping === true);

    return (
        <Dialog open={isAddedToCartModalOpen} onOpenChange={(open) => !open && closeAddedToCartModal()}>
            <DialogContent
                showCloseButton={false}
                className="z-[100] gap-0 p-0 overflow-hidden border-0 bg-white dark:bg-gray-900 shadow-2xl sm:max-w-[440px] rounded-2xl max-sm:top-auto max-sm:bottom-0 max-sm:translate-y-0 max-sm:max-w-full max-sm:rounded-b-none max-sm:data-[state=open]:slide-in-from-bottom"
            >
                {/* Başlık */}
                <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
                    <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                            <Check className="h-4 w-4 text-white stroke-[3]" />
                        </span>
                        <DialogTitle className="text-base font-bold text-gray-900 dark:text-white">Sepetinize eklendi</DialogTitle>
                    </div>
                    <button
                        type="button"
                        onClick={closeAddedToCartModal}
                        aria-label="Kapat"
                        className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Eklenen ürün */}
                <div className="flex gap-4 items-center px-5 pb-4">
                    <div className="relative w-20 h-20 rounded-xl bg-[#f3f5f8] dark:bg-gray-800 overflow-hidden shrink-0">
                        {lastAddedItem.image ? (
                            <Image
                                src={lastAddedItem.image}
                                alt={lastAddedItem.name}
                                fill
                                sizes="80px"
                                className="object-contain p-1.5 mix-blend-multiply dark:mix-blend-normal"
                            />
                        ) : (
                            <ShoppingCart className="h-7 w-7 text-gray-300 absolute inset-0 m-auto" />
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-gray-800 dark:text-gray-100 leading-snug line-clamp-2">
                            {lastAddedItem.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            {lastAddedItem.variantInfo ? `${lastAddedItem.variantInfo} · ` : ""}
                            {lastAddedItem.quantity} adet
                        </p>
                        <p className="text-base font-extrabold text-[#17457C] dark:text-blue-300 mt-1">
                            {formatPrice(lastAddedItem.salePrice || lastAddedItem.listPrice)}
                        </p>
                    </div>
                </div>

                {/* Sepet özeti */}
                <div className="mx-5 mb-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 px-4 py-3 text-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-300">
                            Sepetinizde <strong className="text-gray-900 dark:text-white">{itemCount} ürün</strong>
                        </span>
                        <span className="font-extrabold text-gray-900 dark:text-white">{formatPrice(summary.total)}</span>
                    </div>
                    {allFreeShipping && (
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 mt-1.5">
                            <Truck className="h-3.5 w-3.5" />
                            Kargo ücretsiz
                        </p>
                    )}
                </div>

                {/* Düğmeler */}
                <div className="px-5 pb-5 max-sm:pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            variant="outline"
                            onClick={closeAddedToCartModal}
                            className="h-11 rounded-xl border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-200"
                        >
                            Alışverişe Devam Et
                        </Button>
                        <Button asChild className="h-11 rounded-xl bg-[#17457C] hover:bg-[#0f3460] text-white font-semibold shadow-md shadow-[#17457C]/20">
                            <Link href="/cart" onClick={closeAddedToCartModal}>
                                Sepete Git
                                <ArrowRight className="w-4 h-4 ml-1.5" />
                            </Link>
                        </Button>
                    </div>
                    <p className="text-center text-xs text-gray-500">
                        veya{" "}
                        <Link
                            href={isAuthenticated ? "/checkout" : "/checkout/auth"}
                            onClick={closeAddedToCartModal}
                            className="font-semibold text-[#17457C] dark:text-blue-300 hover:underline"
                        >
                            doğrudan ödemeye geç →
                        </Link>
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
