"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useCartStore } from "@/stores/cart-store";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { Check, ShoppingCart, ArrowRight } from "lucide-react";
import { formatPrice } from "@/lib/helpers";

export function AddedToCartModal() {
    const {
        isAddedToCartModalOpen,
        closeAddedToCartModal,
        lastAddedItem,
        isAuthenticated
    } = useCartStore();

    if (!lastAddedItem) return null;

    return (
        <Dialog open={isAddedToCartModalOpen} onOpenChange={(open) => !open && closeAddedToCartModal()}>
            <DialogContent className="sm:max-w-[500px] bg-white dark:bg-gray-900 border-none shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-[32px] p-0 overflow-hidden gap-0 z-[100]">
                {/* Elegant Header */}
                <div className="bg-emerald-50/80 dark:bg-emerald-900/10 p-6 flex items-center justify-center gap-3 border-b border-emerald-100/50 dark:border-emerald-800/20 backdrop-blur-sm">
                    <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
                        <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                    </div>
                    <span className="font-bold text-lg text-emerald-900 dark:text-emerald-400">Ürün Sepetinize Eklendi</span>
                </div>

                <div className="p-8">
                    {/* Product Card Section */}
                    <div className="flex gap-6 items-start">
                        {/* Product Image - Larger and cleaner */}
                        <div className="relative w-28 h-28 bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm shrink-0 flex items-center justify-center p-2 group">
                            {lastAddedItem.image ? (
                                <Image
                                    src={lastAddedItem.image}
                                    alt={lastAddedItem.name}
                                    fill
                                    className="object-contain transition-transform duration-500 group-hover:scale-110"
                                />
                            ) : (
                                <ShoppingCart className="h-10 w-10 text-gray-300" />
                            )}
                        </div>

                        {/* Product Details - Better Typography */}
                        <div className="flex-1 space-y-3 pt-1">
                            <h3 className="font-bold text-gray-800 dark:text-white leading-snug text-base">
                                {lastAddedItem.name}
                            </h3>

                            <div className="space-y-1">
                                {lastAddedItem.variantInfo && (
                                    <p className="text-sm text-gray-500 font-medium bg-gray-50 dark:bg-gray-800 inline-block px-2 py-1 rounded-md">
                                        {lastAddedItem.variantInfo}
                                    </p>
                                )}
                                <p className="text-sm text-gray-500">
                                    Adet: <strong className="text-gray-900 dark:text-gray-200">{lastAddedItem.quantity}</strong>
                                </p>
                            </div>

                            <div className="text-xl font-black text-[#17457C] dark:text-[#17457C] tracking-tight">
                                {formatPrice(lastAddedItem.salePrice || lastAddedItem.listPrice)}
                            </div>
                        </div>
                    </div>

                    {/* Actions - Modern Large Buttons */}
                    <div className="flex items-center gap-4 mt-8">
                        <Button
                            variant="outline"
                            onClick={closeAddedToCartModal}
                            className="flex-1 h-14 rounded-2xl border-2 border-gray-200 dark:border-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold transition-all"
                        >
                            Alışverişe Devam Et
                        </Button>

                        <Link href={isAuthenticated ? "/checkout" : "/checkout/auth"} onClick={closeAddedToCartModal} className="flex-1">
                            <Button className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
                                Sepete Git
                                <ArrowRight className="w-5 h-5" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
