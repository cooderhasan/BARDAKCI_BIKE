import { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import { getStoreType, getStoreFilter } from "@/lib/store-helper";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const headersList = await headers();
    const host = headersList.get("host") || "www.bardakcibike.com.tr";
    const baseUrl = `https://${host}`;
    const activeStore = (host.includes("motovitrin") || host.startsWith("motor.")) ? "MOTOR" : "BIKE";
    const storeFilter = getStoreFilter(activeStore);

    // Core static routes
    const routes = [
        { route: "", changeFrequency: "daily" as const, priority: 1.0 },
        { route: "/products", changeFrequency: "daily" as const, priority: 0.9 },
        { route: "/indirimli-urunler", changeFrequency: "daily" as const, priority: 0.9 },
        { route: "/about", changeFrequency: "monthly" as const, priority: 0.5 },
        { route: "/contact", changeFrequency: "monthly" as const, priority: 0.5 },
        { route: "/sss", changeFrequency: "monthly" as const, priority: 0.5 },
        { route: "/blog", changeFrequency: "daily" as const, priority: 0.8 },
    ].map((item) => ({
        url: `${baseUrl}${item.route}`,
        lastModified: new Date(),
        changeFrequency: item.changeFrequency,
        priority: item.priority,
    }));

    // Dynamic policies from DB
    let policies: { slug: string; updatedAt: Date }[] = [];
    try {
        policies = await prisma.policy.findMany({
            select: { slug: true, updatedAt: true },
        });
    } catch (error) {
        console.warn("Could not fetch policies for sitemap, skipping.", error);
    }

    // Determine path based on folder structure (some are directly in policies/slug, others in policies/[slug])
    // The static folders we found are: kvkk, privacy, cookies, cancellation, distance-sales, membership
    const staticFolders = ["kvkk", "privacy", "cookies", "cancellation", "distance-sales", "membership"];
    const policyUrls = policies.map((policy) => {
        const isStaticFolder = staticFolders.includes(policy.slug);
        const path = isStaticFolder ? `/policies/${policy.slug}` : `/policies/${policy.slug}`; // Both map to the same route logic
        return {
            url: `${baseUrl}${path}`,
            lastModified: policy.updatedAt,
            changeFrequency: "monthly" as const,
            priority: 0.3,
        };
    });

    // Categories
    let categories: { slug: string }[] = [];
    try {
        categories = await prisma.category.findMany({
            where: { isActive: true, store: storeFilter as any },
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
            where: { isActive: true, store: storeFilter as any },
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

    // Blog Posts
    let blogPosts: { slug: string; updatedAt: Date }[] = [];
    try {
        blogPosts = await prisma.blogPost.findMany({
            where: { isActive: true },
            select: { slug: true, updatedAt: true },
        });
    } catch (error) {
        console.warn("Could not fetch blog posts for sitemap, skipping.", error);
    }

    const blogPostUrls = blogPosts.map((post) => ({
        url: `${baseUrl}/blog/${post.slug}`,
        lastModified: post.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7,
    }));

    return [...routes, ...policyUrls, ...categoryUrls, ...productUrls, ...blogPostUrls];
}
