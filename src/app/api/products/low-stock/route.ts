import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";

export async function GET() {
    if (!(await isAdminRequest())) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    try {
        // Stok kritik seviyenin altında veya sıfır olan ürünleri getir
        const lowStockProducts = await prisma.$queryRaw<Array<{
            id: string;
            name: string;
            sku: string | null;
            stock: number;
            criticalStock: number;
            categoryName: string | null;
            brandName: string | null;
        }>>`
            SELECT 
                p.id,
                p.name,
                p.sku,
                p.stock,
                p."criticalStock",
                c.name as "categoryName",
                b.name as "brandName"
            FROM products p
            LEFT JOIN categories c ON p."categoryId" = c.id
            LEFT JOIN brands b ON p."brandId" = b.id
            WHERE p."isActive" = true AND p.stock <= p."criticalStock"
            ORDER BY p.stock ASC, p.name ASC
        `;

        // Format the response
        const formattedProducts = lowStockProducts.map(p => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            stock: p.stock,
            criticalStock: p.criticalStock,
            category: p.categoryName ? { name: p.categoryName } : null,
            brand: p.brandName ? { name: p.brandName } : null,
        }));

        return NextResponse.json(formattedProducts);
    } catch (error) {
        console.error("Error fetching low stock products:", error);
        return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
    }
}
