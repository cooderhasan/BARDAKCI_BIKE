import { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.bardakcibike.com.tr";

    // Static pages
    const routes = [
        "",
        "/about",
        "/contact",
        "/products",
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: "daily" as const,
        priority: route === "" ? 1 : 0.8,
    }));

    // Categories
    let categories: { slug: string }[] = [];
    try {
        categories = await prisma.category.findMany({
            where: { isActive: true },
            select: { slug: true },
        });
    } catch (error) {
        console.warn("Could not fetch categories for sitemap, skipping.", error);
    }

    const categoryUrls = categories.map((category) => ({
        url: `${baseUrl}/category/${category.slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.8,
    }));

    // Products
    let products: { slug: string; updatedAt: Date }[] = [];
    try {
        products = await prisma.product.findMany({
            where: { isActive: true },
            select: { slug: true, updatedAt: true },
        });
    } catch (error) {
        console.warn("Could not fetch products for sitemap, skipping.", error);
    }

    const productUrls = products.map((product) => ({
        url: `${baseUrl}/products/${product.slug}`,
        lastModified: product.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7,
    }));

    return [...routes, ...categoryUrls, ...productUrls];
}
