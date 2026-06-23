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

        return NextResponse.json({
            success: true,
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
            recentProducts: recentProducts.map(p => ({
                id: p.id,
                name: p.name,
                createdAt: p.createdAt,
                isActive: p.isActive,
                categories: p.categories
            })),
            keywordsCats: keywordsCats.map(c => ({
                id: c.id,
                name: c.name,
                slug: c.slug,
                parentId: c.parentId,
                parentName: c.parent ? c.parent.name : null
            }))
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message });
    }
}
