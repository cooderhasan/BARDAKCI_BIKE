import { getCargoPricing } from "@/lib/cargo-pricing";
import CartView from "./cart-view";

// Kargo tarifesi sunucuda okunur ki sepet kargo ücretini ödeme ekranıyla aynı hesapla gösterebilsin
export default async function CartPage() {
    const { cargoCompanies, freeShippingLimit } = await getCargoPricing();
    return <CartView cargoCompanies={cargoCompanies} freeShippingLimit={freeShippingLimit} />;
}
