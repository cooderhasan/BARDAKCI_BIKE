import { prisma } from "@/lib/db";
import { getSiteSettings } from "@/lib/settings";
import type { CargoPricing } from "@/lib/shipping";

/**
 * Aktif kargo firmaları + desi tarifeleri (client component'e geçebilecek düz sayılarla) ve ücretsiz kargo limiti.
 * Sepet ve ödeme sayfası aynı listeyi kullanır; ilk firma (ada göre) ikisinde de varsayılan seçili olur.
 */
export async function getCargoPricing(): Promise<{ cargoCompanies: CargoPricing[]; freeShippingLimit: number }> {
    const [companies, settings] = await Promise.all([
        prisma.cargoCompany.findMany({
            where: { isActive: true },
            include: { desiPrices: { orderBy: { minDesi: "asc" } } },
            orderBy: { name: "asc" },
        }) as Promise<any[]>,
        getSiteSettings(),
    ]);

    return {
        cargoCompanies: companies.map((company) => ({
            id: company.id,
            name: company.name,
            isDesiActive: !!company.isDesiActive,
            desiPrices: (company.desiPrices || []).map((price: any) => ({
                id: price.id,
                minDesi: Number(price.minDesi),
                maxDesi: Number(price.maxDesi),
                price: Number(price.price),
                multiplierType: price.multiplierType || "FIXED",
            })),
        })),
        freeShippingLimit: Number(settings.freeShippingLimit) || 20000,
    };
}
