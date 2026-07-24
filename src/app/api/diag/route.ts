import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        // 1. Fetch Çocuk Bisikleti category hierarchy
        const childCat = await prisma.category.findUnique({
            where: { slug: "cocuk-bisikleti" },
            include: {
                children: {
                    include: {
                        _count: { select: { products: true } }
                    }
                }
            }
        });

        // 2. Fetch all products containing "bisiklet" or recently created
        const recentProducts = await prisma.product.findMany({
            orderBy: { createdAt: "desc" },
            take: 20,
            include: {
                categories: {
                    select: { id: true, name: true, slug: true, parentId: true }
                }
            }
        });

        // 3. Fetch all categories containing "bisiklet" or "çocuk" or "kız"
        const keywordsCats = await prisma.category.findMany({
            where: {
                OR: [
                    { name: { contains: "çocuk", mode: "insensitive" } },
                    { name: { contains: "cocuk", mode: "insensitive" } },
                    { name: { contains: "kız", mode: "insensitive" } },
                    { name: { contains: "kiz", mode: "insensitive" } },
                    { name: { contains: "jant", mode: "insensitive" } }
                ]
            },
            include: {
                parent: { select: { name: true, slug: true } }
            }
        });

        // 4. Test Pazarama Config & Category Endpoints
        let pazaramaDiag: any = null;
        try {
            const config = await (prisma as any).pazaramaConfig.findFirst();
            if (config) {
                const { PazaramaClient } = await import("@/services/pazarama/api");
                const client = new PazaramaClient(config);
                const tokenRes = await (client as any).getToken();
                const baseUrl = config.isTestMode
                    ? "https://stage-isortagimapi.pazarama.com"
                    : "https://isortagimapi.pazarama.com";

                const endpoints = [
                    { url: `${baseUrl}/category/get-categories`, method: "GET" },
                    { url: `${baseUrl}/category/get-categories`, method: "POST", body: {} },
                    { url: `${baseUrl}/api/v1/category/get-categories`, method: "GET" },
                    { url: `${baseUrl}/api/v1/category/get-categories`, method: "POST", body: {} },
                    { url: `${baseUrl}/category/getCategories`, method: "GET" },
                    { url: `${baseUrl}/category/getCategories`, method: "POST", body: {} },
                    { url: `${baseUrl}/category/getCategoryWithAttributes`, method: "GET" },
                    { url: `${baseUrl}/api/v1/category/getCategoryWithAttributes`, method: "GET" },
                ];

                const epResults: any[] = [];
                if (tokenRes.success) {
                    for (const ep of endpoints) {
                        try {
                            const res = await fetch(ep.url, {
                                method: ep.method,
                                headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${tokenRes.accessToken}`,
                                },
                                ...(ep.body ? { body: JSON.stringify(ep.body) } : {}),
                                cache: "no-store",
                            });

                            const text = await res.text();
                            let parsed = null;
                            try { parsed = JSON.parse(text); } catch {}

                            epResults.push({
                                url: ep.url,
                                method: ep.method,
                                status: res.status,
                                response: parsed || text.slice(0, 200),
                            });
                        } catch (e: any) {
                            epResults.push({ url: ep.url, method: ep.method, error: e.message });
                        }
                    }
                }

                pazaramaDiag = {
                    configFound: true,
                    isActive: config.isActive,
                    isTestMode: config.isTestMode,
                    tokenRes,
                    epResults,
                };
            } else {
                pazaramaDiag = { configFound: false };
            }
        } catch (e: any) {
            pazaramaDiag = { error: e.message };
        }

        return NextResponse.json({
            success: true,
            pazaramaDiag,
            childCat: childCat ? {
                id: childCat.id,
                name: childCat.name,
                slug: childCat.slug,
                children: childCat.children.map(c => ({
                    id: c.id,
                    name: c.name,
                    slug: c.slug,
                    parentId: c.parentId,
                    productsCount: c._count.products
                }))
            } : "Not Found",
            keywordsCatsCount: keywordsCats.length,
            keywordsCats: keywordsCats.map(c => ({
                id: c.id,
                name: c.name,
                slug: c.slug,
                parent: c.parent ? c.parent.name : null
            })),
            recentProductsCount: recentProducts.length,
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message });
    }
}
