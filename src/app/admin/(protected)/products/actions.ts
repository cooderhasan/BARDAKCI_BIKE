"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { productSchema } from "@/lib/validations";
import { generateSlug } from "@/lib/helpers";
import { syncProductsToTrendyol } from "../integrations/trendyol/actions";
import { syncProductsToN11 } from "../integrations/n11/actions";
import { syncProductsToHepsiburada } from "../integrations/hepsiburada/actions";

export async function createProduct(formData: FormData) {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
        throw new Error("Unauthorized");
    }

    // Generate a unique slug: if the slug already exists in DB, append -1, -2, etc.
    const baseSlug = (formData.get("slug") as string) || generateSlug(formData.get("name") as string);
    let uniqueSlug = baseSlug;
    let slugCounter = 0;
    while (true) {
        const existing = await prisma.product.findFirst({ where: { slug: uniqueSlug } });
        if (!existing) break;
        slugCounter++;
        uniqueSlug = `${baseSlug}-${slugCounter}`;
    }

    const rawData = {
        name: formData.get("name") as string,
        slug: uniqueSlug,
        sku: (formData.get("sku") as string) || undefined,
        barcode: (formData.get("barcode") as string) || undefined,
        brandId: (formData.get("brandId") as string) === "none" ? undefined : (formData.get("brandId") as string) || undefined,
        origin: (formData.get("origin") as string) || undefined,
        description: formData.get("description") as string || undefined,
        marketplaceDescription: formData.get("marketplaceDescription") as string || undefined,
        listPrice: Number(formData.get("listPrice")),
        salePrice: formData.get("salePrice") ? Number(formData.get("salePrice")) : null,
        trendyolPrice: formData.get("trendyolPrice") ? Number(formData.get("trendyolPrice")) : undefined,
        n11Price: formData.get("n11Price") ? Number(formData.get("n11Price")) : undefined,
        hepsiburadaPrice: formData.get("hepsiburadaPrice") ? Number(formData.get("hepsiburadaPrice")) : undefined,
        vatRate: Number(formData.get("vatRate")),
        minQuantity: Number(formData.get("minQuantity")) || 1,
        stock: Number(formData.get("stock")) || 0,
        criticalStock: Number(formData.get("criticalStock")) || 10,
        isBundle: formData.get("isBundle") === "true",

        // categoryId: (formData.get("categoryId") as string) === "none" ? undefined : (formData.get("categoryId") as string) || undefined,
        isFeatured: formData.get("isFeatured") === "true",
        isNew: formData.get("isNew") === "true",
        isBestSeller: formData.get("isBestSeller") === "true",
        isActive: formData.get("isActive") !== "false",
        // Marketplace Visibility
        isTrendyolActive: formData.get("isTrendyolActive") === "true",
        isN11Active: formData.get("isN11Active") === "true",
        isHepsiburadaActive: formData.get("isHepsiburadaActive") === "true",
        isGoogleActive: formData.get("isGoogleActive") === "true",
        googlePrice: formData.get("googlePrice") ? Number(formData.get("googlePrice")) : undefined,
        // Kargo & Desi
        weight: formData.get("weight") ? Number(formData.get("weight")) : null,
        width: formData.get("width") ? Number(formData.get("width")) : null,
        height: formData.get("height") ? Number(formData.get("height")) : null,
        length: formData.get("length") ? Number(formData.get("length")) : null,
        desi: formData.get("desi") ? Number(formData.get("desi")) : null,
        referenceUrl: (formData.get("referenceUrl") as string) || undefined,
        n11CatalogId: (formData.get("n11CatalogId") as string) || null,
        gender: (formData.get("gender") as string) === "none" ? undefined : (formData.get("gender") as string) || undefined,
        brakeType: (formData.get("brakeType") as string) === "none" ? undefined : (formData.get("brakeType") as string) || undefined,
    };

    const categoryIdsJson = formData.get("categoryIds") as string;
    const categoryIds: string[] = categoryIdsJson ? JSON.parse(categoryIdsJson) : [];

    // Merge categoryIds into rawData for validation
    Object.assign(rawData, { categoryIds });

    const validatedData = productSchema.parse(rawData);

    // Parse images from JSON string
    const imagesJson = formData.get("images") as string;
    const images: string[] = imagesJson ? JSON.parse(imagesJson) : [];

    // Parse variants from JSON string
    const variantsJson = formData.get("variants") as string;
    const variants = variantsJson ? JSON.parse(variantsJson) : [];

    // Destructure relation fields from validated data
    const { brandId, categoryIds: validCategoryIds, ...productData } = validatedData;

    const product = await prisma.product.create({
        data: {
            ...productData,
            images,
            ...(brandId && brandId !== "none" && { brand: { connect: { id: brandId } } }),
            categories: {
                connect: validCategoryIds.map((id) => ({ id })),
            },
        },
    });

    // Create variants separately
    if (variants.length > 0) {
        await prisma.productVariant.createMany({
            data: variants.map((v: { color?: string; size?: string; sku?: string; barcode?: string; stock?: number; priceAdjustment?: number; isActive?: boolean }) => ({
                productId: product.id,
                color: v.color || null,
                size: v.size || null,
                sku: v.sku || null,
                barcode: v.barcode || null,
                stock: v.stock || 0,
                priceAdjustment: v.priceAdjustment || 0,
                isActive: v.isActive !== false,
            })),
        });
    }

    // Create bundle items if this is a bundle product
    if (validatedData.isBundle) {
        const bundleItemsJson = formData.get("bundleItems") as string;
        const bundleItems: { childProductId: string; quantity: number }[] = bundleItemsJson ? JSON.parse(bundleItemsJson) : [];
        if (bundleItems.length > 0) {
            await prisma.bundleItem.createMany({
                data: bundleItems.map((bi) => ({
                    bundleProductId: product.id,
                    childProductId: bi.childProductId,
                    quantity: bi.quantity || 1,
                })),
            });
        }
    }

    await prisma.adminLog.create({
        data: {
            adminId: session.user.id,
            action: "CREATE_PRODUCT",
            entityType: "Product",
            entityId: product.id,
            newData: validatedData,
        },
    });

    revalidatePath("/admin/products");
    revalidatePath("/products");
    revalidatePath("/");

    return { success: true };
}

export async function updateProduct(productId: string, formData: FormData) {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
        throw new Error("Unauthorized");
    }

    const oldProduct = await prisma.product.findUnique({ where: { id: productId } });

    console.log("--- Update Product Started ---");
    console.log("ProductId:", productId);
    // Log all form data keys to see what's coming in
    for (const [key, value] of formData.entries()) {
        console.log(`${key}:`, value);
    }

    const rawData = {
        name: formData.get("name") as string,
        slug: formData.get("slug") as string,
        sku: (formData.get("sku") as string) || undefined,
        barcode: (formData.get("barcode") as string) || undefined,
        brandId: (formData.get("brandId") as string) === "none" ? undefined : (formData.get("brandId") as string) || undefined,
        origin: (formData.get("origin") as string) || undefined,
        description: formData.get("description") as string || undefined,
        marketplaceDescription: formData.get("marketplaceDescription") as string || undefined,
        listPrice: Number(formData.get("listPrice")),
        salePrice: formData.get("salePrice") ? Number(formData.get("salePrice")) : null,
        trendyolPrice: formData.get("trendyolPrice") ? Number(formData.get("trendyolPrice")) : undefined,
        n11Price: formData.get("n11Price") ? Number(formData.get("n11Price")) : undefined,
        hepsiburadaPrice: formData.get("hepsiburadaPrice") ? Number(formData.get("hepsiburadaPrice")) : undefined,
        vatRate: Number(formData.get("vatRate")),
        minQuantity: Number(formData.get("minQuantity")) || 1,
        stock: Number(formData.get("stock")) || 0,
        criticalStock: Number(formData.get("criticalStock")) || 10,
        isBundle: formData.get("isBundle") === "true",

        // categoryId: (formData.get("categoryId") as string) === "none" ? undefined : (formData.get("categoryId") as string) || undefined,
        isFeatured: formData.get("isFeatured") === "true",
        isNew: formData.get("isNew") === "true",
        isBestSeller: formData.get("isBestSeller") === "true",
        isActive: formData.get("isActive") !== "false",
        // Marketplace Visibility
        isTrendyolActive: formData.get("isTrendyolActive") === "true",
        isN11Active: formData.get("isN11Active") === "true",
        isHepsiburadaActive: formData.get("isHepsiburadaActive") === "true",
        isGoogleActive: formData.get("isGoogleActive") === "true",
        googlePrice: formData.get("googlePrice") ? Number(formData.get("googlePrice")) : undefined,
        // Kargo & Desi
        weight: formData.get("weight") ? Number(formData.get("weight")) : null,
        width: formData.get("width") ? Number(formData.get("width")) : null,
        height: formData.get("height") ? Number(formData.get("height")) : null,
        length: formData.get("length") ? Number(formData.get("length")) : null,
        desi: formData.get("desi") ? Number(formData.get("desi")) : null,
        referenceUrl: (formData.get("referenceUrl") as string) || undefined,
        n11CatalogId: (formData.get("n11CatalogId") as string) || null,
        gender: (formData.get("gender") as string) === "none" ? null : (formData.get("gender") as string) || null,
        brakeType: (formData.get("brakeType") as string) === "none" ? null : (formData.get("brakeType") as string) || null,
    };

    const categoryIdsJson = formData.get("categoryIds") as string;
    const categoryIds: string[] = categoryIdsJson ? JSON.parse(categoryIdsJson) : [];

    // Merge categoryIds into rawData for validation
    Object.assign(rawData, { categoryIds });

    const validatedData = productSchema.parse(rawData);

    // Parse images from JSON string
    const imagesJson = formData.get("images") as string;
    const images: string[] = imagesJson ? JSON.parse(imagesJson) : [];

    // Parse variants from JSON string
    const variantsJson = formData.get("variants") as string;
    const variants = variantsJson ? JSON.parse(variantsJson) : [];

    // Delete existing variants and recreate
    await prisma.productVariant.deleteMany({
        where: { productId },
    });

    // Extract relation IDs and remove from validatedData for update
    const { brandId, categoryIds: validIds, ...updateData } = validatedData;

    await prisma.product.update({
        where: { id: productId },
        data: {
            ...updateData,
            images,
            brand: brandId ? { connect: { id: brandId } } : { disconnect: true },
            // category: categoryId ? { connect: { id: categoryId } } : { disconnect: true },
            categories: {
                set: validatedData.categoryIds.map((id) => ({ id })),
            },
        },
    });

    // Create new variants
    if (variants.length > 0) {
        await prisma.productVariant.createMany({
            data: variants.map((v: { color?: string; size?: string; sku?: string; barcode?: string; stock?: number; priceAdjustment?: number; isActive?: boolean }) => ({
                productId,
                color: v.color || null,
                size: v.size || null,
                sku: v.sku || null,
                barcode: v.barcode || null,
                stock: v.stock || 0,
                priceAdjustment: v.priceAdjustment || 0,
                isActive: v.isActive !== false,
            })),
        });
    }

    await prisma.adminLog.create({
        data: {
            adminId: session.user.id,
            action: "UPDATE_PRODUCT",
            entityType: "Product",
            entityId: productId,
            oldData: oldProduct ? JSON.parse(JSON.stringify(oldProduct)) : null,
            newData: validatedData,
        },
    });

    // Update bundle items if this is a bundle product
    if (validatedData.isBundle) {
        // Delete existing bundle items and recreate
        await prisma.bundleItem.deleteMany({
            where: { bundleProductId: productId },
        });
        const bundleItemsJson = formData.get("bundleItems") as string;
        const bundleItems: { childProductId: string; quantity: number }[] = bundleItemsJson ? JSON.parse(bundleItemsJson) : [];
        if (bundleItems.length > 0) {
            await prisma.bundleItem.createMany({
                data: bundleItems.map((bi) => ({
                    bundleProductId: productId,
                    childProductId: bi.childProductId,
                    quantity: bi.quantity || 1,
                })),
            });
        }
    } else {
        // If product was a bundle but is no longer, remove bundle items
        await prisma.bundleItem.deleteMany({
            where: { bundleProductId: productId },
        });
    }

    revalidatePath("/admin/products");
    revalidatePath("/products");
    revalidatePath(`/products/${validatedData.slug}`);
    revalidatePath("/");

    // --- ANLIK PAZARYERİ SENKRONİZASYONU ---
    // Ürün güncellendiğinde (stok/fiyat değişmiş olabilir), anlık olarak pazaryerlerini güncelle
    try {
        // Doğrudan import edilen senkronizasyon fonksiyonlarını kullanıyoruz
        // Not: Bu işlemler arka planda (await edilmeden) tetikleniyor ki kullanıcıyı bekletmesin
        if (validatedData.isTrendyolActive) syncProductsToTrendyol([productId]).catch(console.error);
        if (validatedData.isN11Active) syncProductsToN11([productId]).catch(console.error);
        if (validatedData.isHepsiburadaActive) syncProductsToHepsiburada([productId]).catch(console.error);
        
        // Yedek olarak kuyruğa da ekleyebiliriz (opsiyonel)
        const { addMarketplaceSyncJob } = await import("@/lib/queue/producer");
        await addMarketplaceSyncJob({ marketplace: "trendyol", type: "stocks", productIds: [productId] }).catch(console.error);
        await addMarketplaceSyncJob({ marketplace: "n11", type: "stocks", productIds: [productId] }).catch(console.error);
        await addMarketplaceSyncJob({ marketplace: "hepsiburada", type: "stocks", productIds: [productId] }).catch(console.error);
    } catch (e) {
        console.error("Marketplace instant sync error:", e);
    }

    return { success: true };
}

export async function deleteProduct(productId: string) {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
        throw new Error("Unauthorized");
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });

    await prisma.product.delete({ where: { id: productId } });

    await prisma.adminLog.create({
        data: {
            adminId: session.user.id,
            action: "DELETE_PRODUCT",
            entityType: "Product",
            entityId: productId,
            oldData: product ? JSON.parse(JSON.stringify(product)) : null,
        },
    });

    revalidatePath("/admin/products");
}


export async function toggleProductStatus(productId: string, isActive: boolean) {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
        throw new Error("Unauthorized");
    }

    await prisma.product.update({
        where: { id: productId },
        data: { isActive },
    });

    revalidatePath("/admin/products");
}

export async function toggleTrendyolStatus(productId: string, isTrendyolActive: boolean) {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
        throw new Error("Unauthorized");
    }

    await prisma.product.update({
        where: { id: productId },
        data: { isTrendyolActive },
    });

    // --- OTOMATİK PAZARYERİ SENKRONİZASYONU ---
    // Trendyol durumu değiştiğinde (kapatılmış olabilir), hemen kuyruğa at
    try {
        const { addMarketplaceSyncJob } = await import("@/lib/queue/producer");
        await addMarketplaceSyncJob({ marketplace: "trendyol", type: "stocks", productIds: [productId] });
    } catch (e) {
        console.error("Marketplace sync queue error:", e);
    }

    revalidatePath("/admin/products");
    return { success: true };
}

export async function toggleN11Status(productId: string, isN11Active: boolean) {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
        throw new Error("Unauthorized");
    }

    await prisma.product.update({
        where: { id: productId },
        data: { isN11Active },
    });

    // --- OTOMATİK PAZARYERİ SENKRONİZASYONU ---
    // N11 durumu değiştiğinde (kapatılmış olabilir), hemen kuyruğa at
    try {
        const { addMarketplaceSyncJob } = await import("@/lib/queue/producer");
        await addMarketplaceSyncJob({ marketplace: "n11", type: "stocks", productIds: [productId] });
    } catch (e) {
        console.error("Marketplace sync queue error:", e);
    }

    revalidatePath("/admin/products");
    return { success: true };
}

export async function toggleHepsiburadaStatus(productId: string, isHepsiburadaActive: boolean) {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
        throw new Error("Unauthorized");
    }

    await prisma.product.update({
        where: { id: productId },
        data: { isHepsiburadaActive },
    });

    // --- OTOMATİK PAZARYERİ SENKRONİZASYONU ---
    // Hepsiburada durumu değiştiğinde (kapatılmış olabilir), hemen kuyruğa at
    try {
        const { addMarketplaceSyncJob } = await import("@/lib/queue/producer");
        await addMarketplaceSyncJob({ marketplace: "hepsiburada", type: "stocks", productIds: [productId] });
    } catch (e) {
        console.error("Marketplace sync queue error:", e);
    }

    revalidatePath("/admin/products");
    return { success: true };
}

export async function syncProductToMarketplaces(productId: string) {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
        throw new Error("Unauthorized");
    }

    const product = await prisma.product.findUnique({
        where: { id: productId }
    });

    if (!product) return { success: false, message: "Ürün bulunamadı." };

    const results: string[] = [];

    // Trendyol Sync
    if ((product as any).isTrendyolActive) {
        try {
            const res = await syncProductsToTrendyol([productId]);
            results.push(`Trendyol: ${res.success ? "Başarılı" : res.message}`);
        } catch (e: any) {
            results.push(`Trendyol: Hata (${e.message})`);
        }
    }

    // N11 Sync
    if ((product as any).isN11Active) {
        try {
            const res = await syncProductsToN11([productId]);
            results.push(`N11: ${res.success ? "Başarılı" : res.message}`);
        } catch (e: any) {
            results.push(`N11: Hata (${e.message})`);
        }
    }

    // Hepsiburada Sync
    if ((product as any).isHepsiburadaActive) {
        try {
            const res = await syncProductsToHepsiburada([productId]);
            results.push(`Hepsiburada: ${res.success ? "Başarılı" : res.message}`);
        } catch (e: any) {
            results.push(`Hepsiburada: Hata (${e.message})`);
        }
    }

    if (results.length === 0) {
        return { success: false, message: "Ürün hiçbir pazar yerinde aktif değil veya seçim yapılmamış." };
    }

    return { success: true, message: results.join(" | ") };
}

export async function fixAllSlugs() {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        const products = await prisma.product.findMany({
            select: { id: true, name: true, slug: true }
        });

        let fixedCount = 0;

        for (const product of products) {
            const expectedBase = generateSlug(product.name);
            
            let currentPure = product.slug;
            const parts = product.slug.split('-');
            if (parts.length > 1 && parts[parts.length - 1].length < 10 && !isNaN(parseInt(parts[parts.length - 1], 36))) {
                currentPure = parts.slice(0, -1).join('-');
            }

            if (currentPure !== expectedBase) {
                let newSlug = expectedBase;
                let isUnique = false;
                let counter = 0;
                
                while (!isUnique) {
                    const checkSlug = counter === 0 ? newSlug : `${newSlug}-${counter}`;
                    const existing = await prisma.product.findFirst({ where: { slug: checkSlug } });
                    if (!existing || existing.id === product.id) {
                        newSlug = checkSlug;
                        isUnique = true;
                    } else {
                        counter++;
                    }
                }

                await prisma.product.update({
                    where: { id: product.id },
                    data: { slug: newSlug }
                });
                
                fixedCount++;
            }
        }

        revalidatePath("/admin/products");
        revalidatePath("/products");
        return { success: true, fixedCount };
    } catch (e: any) {
        console.error("Fix slugs error:", e);
        return { success: false, message: e.message || "An error occurred" };
    }
}

// ==================== BUNDLE (PAKET ÜRÜN) ====================

export async function searchProductsForBundle(query: string, excludeProductId?: string) {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
        throw new Error("Unauthorized");
    }

    if (!query || query.length < 2) return [];

    const products = await prisma.product.findMany({
        where: {
            AND: [
                {
                    OR: [
                        { name: { contains: query, mode: "insensitive" } },
                        { sku: { contains: query, mode: "insensitive" } },
                        { barcode: { contains: query, mode: "insensitive" } },
                    ],
                },
                { isBundle: false }, // Paket içine paket eklenemez
                { isActive: true },
                ...(excludeProductId ? [{ id: { not: excludeProductId } }] : []),
            ],
        },
        select: {
            id: true,
            name: true,
            sku: true,
            stock: true,
            listPrice: true,
            salePrice: true,
            images: true,
        },
        take: 10,
    });

    return products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        stock: p.stock,
        listPrice: Number(p.listPrice),
        salePrice: p.salePrice ? Number(p.salePrice) : null,
        image: p.images[0] || null,
    }));
}

export async function toggleProductFeature(
    productId: string, 
    feature: "isFeatured" | "isNew" | "isBestSeller", 
    value: boolean
) {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR")) {
        throw new Error("Unauthorized");
    }

    if (feature !== "isFeatured" && feature !== "isNew" && feature !== "isBestSeller") {
        throw new Error("Invalid feature type");
    }

    await prisma.product.update({
        where: { id: productId },
        data: { [feature]: value },
    });

    revalidatePath("/admin/products");
    revalidatePath("/products");
    revalidatePath("/");
    return { success: true };
}
