"use server";

import { prisma } from "@/lib/db";

export type QuickOrderProduct = {
    id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    slug: string;
    stock: number;
    price: number;
    image: string | null;
    vatRate: number;
    minQuantity: number;
    desi?: number | null;
    isFreeShipping?: boolean;
};

export async function getProductByCode(code: string): Promise<{ success: boolean; product?: QuickOrderProduct; error?: string }> {
    if (!code || code.length < 3) {
        return { success: false, error: "Kod en az 3 karakter olmalı." };
    }

    try {
        const product = await prisma.product.findFirst({
            where: {
                OR: [
                    { sku: code },
                    { barcode: code }
                ],
                isActive: true,
            },
            select: {
                id: true,
                name: true,
                sku: true,
                barcode: true,
                slug: true,
                stock: true,
                listPrice: true,
                vatRate: true,
                minQuantity: true,
                images: true,
                weight: true,
                desi: true,
                isFreeShipping: true,
            }
        });

        if (!product) {
            return { success: false, error: "Ürün bulunamadı." };
        }

        // Parse price safely
        const price = Number(product.listPrice);
        const image = product.images && (product.images as string[]).length > 0 ? (product.images as string[])[0] : null;

        return {
            success: true,
            product: {
                id: product.id,
                name: product.name,
                sku: product.sku,
                barcode: product.barcode,
                slug: product.slug,
                stock: product.stock,
                price,
                image,
                vatRate: product.vatRate,
                minQuantity: product.minQuantity,
                desi: Number(product.desi || product.weight || 0),
                isFreeShipping: product.isFreeShipping ?? false,
            }
        };

    } catch (error) {
        console.error("Quick order lookup error:", error);
        return { success: false, error: "Arama sırasında bir hata oluştu." };
    }
}
