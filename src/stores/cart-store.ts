import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CartItem, CartSummary } from "@/types";
import { calculateCartSummary } from "@/lib/helpers";
import { syncCart } from "@/app/(storefront)/cart/actions";

interface CartState {
    items: CartItem[];
    discountRate: number;
    isSyncing: boolean;
    isAuthenticated: boolean;
    _hasHydrated: boolean; // Add hydration tracking
    setDiscountRate: (rate: number) => void;
    setIsAuthenticated: (val: boolean) => void;
    addItem: (item: CartItem) => void;
    // variantId: aynı ürünün farklı varyantları sepette ayrı satırdır
    removeItem: (productId: string, variantId?: string) => void;
    updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
    clearCart: () => void;
    getSummary: () => CartSummary;
    setItems: (items: CartItem[]) => void;
    logout: () => void;
    setHasHydrated: (val: boolean) => void;

    // Added to Cart Modal State
    lastAddedItem: CartItem | null;
    isAddedToCartModalOpen: boolean;
    openAddedToCartModal: (item: CartItem) => void;
    closeAddedToCartModal: () => void;
}

/** Sepet satırı: ürün + varyant (varyantsız üründe variantId yok) */
const sameCartLine = (i: { productId: string; variantId?: string | null }, productId: string, variantId?: string | null) =>
    i.productId === productId && (i.variantId || undefined) === (variantId || undefined);

export const useCartStore = create<CartState>()(
    persist(
        (set, get) => ({
            items: [],
            discountRate: 0,
            isSyncing: false,
            isAuthenticated: false,
            _hasHydrated: false,

            setHasHydrated: (val) => set({ _hasHydrated: val }),

            setDiscountRate: (rate) => set({ discountRate: rate }),

            setIsAuthenticated: (val) => set({ isAuthenticated: val }),

            setItems: (items) => set({ items }),

            addItem: async (item) => {
                // ... same as before
                if (item.listPrice <= 0) {
                    console.warn("Cannot add item with price 0 to cart:", item.name);
                    return;
                }
                if (item.stock <= 0) {
                    console.warn("Cannot add out-of-stock item to cart:", item.name);
                    return;
                }

                const items = get().items;
                const itemKey = item.variantId ? `${item.productId}-${item.variantId}` : item.productId;
                const existingIndex = items.findIndex((i) => {
                    const existingKey = i.variantId ? `${i.productId}-${i.variantId}` : i.productId;
                    return existingKey === itemKey;
                });

                let newItems = [...items];
                if (existingIndex >= 0) {
                    const newQuantity = newItems[existingIndex].quantity + item.quantity;
                    if (newQuantity <= item.stock) {
                        newItems[existingIndex].quantity = newQuantity;
                    }
                } else {
                    newItems.push(item);
                }

                set({ items: newItems });

                await syncCart(newItems);
            },

            removeItem: async (productId, variantId) => {
                const newItems = get().items.filter((i) => !sameCartLine(i, productId, variantId));
                set({ items: newItems });

                await syncCart(newItems);
            },

            updateQuantity: async (productId, quantity, variantId) => {
                const items = get().items;
                const itemIndex = items.findIndex((i) => sameCartLine(i, productId, variantId));

                if (itemIndex >= 0) {
                    const item = items[itemIndex];
                    let newItems = [...items];

                    if (quantity >= item.minQuantity && quantity <= item.stock) {
                        newItems[itemIndex].quantity = quantity;
                        set({ items: newItems });
                    } else if (quantity < item.minQuantity) {
                        newItems = items.filter((i) => !sameCartLine(i, productId, variantId));
                        set({ items: newItems });
                    }

                    await syncCart(newItems);
                }
            },

            clearCart: async () => {
                set({ items: [] });
                await syncCart([]);
            },

            getSummary: () => {
                const { items, discountRate } = get();
                return calculateCartSummary(items, discountRate);
            },

            logout: () => {
                set({ items: [], isAuthenticated: false, discountRate: 0 });
            },

            // Modal Actions
            lastAddedItem: null,
            isAddedToCartModalOpen: false,
            openAddedToCartModal: (item) => set({ lastAddedItem: item, isAddedToCartModalOpen: true }),
            closeAddedToCartModal: () => set({ isAddedToCartModalOpen: false }),
        }),
        {
            name: "b2b-cart",
            // IMPORTANT: Do not persist the hydration flag itself
            partialize: (state) => {
                // "Sepetinize eklendi" penceresi de saklanmaz: açıkken sayfa değişince/yenilenince sonraki açılışta
                // (çoğu zaman "0 ürün" ile) yeniden çıkıyordu
                const { _hasHydrated, isAddedToCartModalOpen, lastAddedItem, ...rest } = state as any;
                return rest;
            },
            onRehydrateStorage: () => {
                console.log("STORE_LOG: Rehydration process starting...");
                return (state, error) => {
                    if (error) {
                        console.error("STORE_LOG: Rehydration error:", error);
                    } else {
                        console.log("STORE_LOG: Rehydration finished successfully.");
                        // Eski sürümlerin tarayıcıya kaydettiği "pencere açık" bilgisi açılışta pencereyi göstermesin
                        state?.closeAddedToCartModal();
                        state?.setHasHydrated(true);
                    }
                };
            },
        }
    )
);
