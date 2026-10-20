import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStoreType, getStoreFilter } from "@/lib/store-helper";

/**
 * Canlı arama önerileri (header arama kutusu): yazarken ilk ürünler + eşleşen kategoriler.
 * Arama mantığı ürünler sayfasıyla aynı: tek kelime ad/stok kodu/barkod, çok kelime adında hepsi geçmeli.
 * Sadece o mağazanın aktif ürünleri; stokta olanlar önce. Herkese açık, sadece okuma.
 */
export async function GET(req: NextRequest) {
    const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 80);
    if (q.length < 2) return NextResponse.json({ products: [], categories: [], total: 0 });

    const store = await getStoreType();
    const storeFilter = getStoreFilter(store) as any;
    const words = q.split(/\s+/).filter(Boolean).slice(0, 6);

    const match: any =
        words.length === 1
            ? {
                  OR: [
                      { name: { contains: words[0], mode: "insensitive" } },
                      { sku: { contains: words[0], mode: "insensitive" } },
                      { barcode: { contains: words[0], mode: "insensitive" } },
                  ],
              }
            : { AND: words.map((w) => ({ name: { contains: w, mode: "insensitive" } })) };
    const where = { AND: [{ isActive: true }, { store: storeFilter }, match] };

    try {
        const [inStock, outOfStock, total, categories] = await Promise.all([
            prisma.product.findMany({
                where: { AND: [where, { stock: { gt: 0 } }] },
                select: { id: true, name: true, slug: true, images: true, listPrice: true, salePrice: true, stock: true },
                orderBy: { createdAt: "desc" },
                take: 6,
            }),
            prisma.product.findMany({
                where: { AND: [where, { stock: { lte: 0 } }] },
                select: { id: true, name: true, slug: true, images: true, listPrice: true, salePrice: true, stock: true },
                orderBy: { createdAt: "desc" },
                take: 6,
            }),
            prisma.product.count({ where }),
            prisma.category.findMany({
                where: {
                    isActive: true,
                    store: storeFilter,
                    AND: words.map((w) => ({ name: { contains: w, mode: "insensitive" } })),
                },
                select: { name: true, slug: true },
                orderBy: { order: "asc" },
                take: 3,
            }),
        ]);

        const products = [...inStock, ...outOfStock].slice(0, 6).map((p) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            image: p.images?.[0] || null,
            price: Number(p.salePrice && Number(p.salePrice) > 0 ? p.salePrice : p.listPrice),
            oldPrice: p.salePrice && Number(p.salePrice) > 0 && Number(p.salePrice) < Number(p.listPrice) ? Number(p.listPrice) : null,
            inStock: p.stock > 0,
        }));

        return NextResponse.json(
            { products, categories, total },
            { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } }
        );
    } catch (e) {
        console.error("search suggest error:", e);
        return NextResponse.json({ products: [], categories: [], total: 0 });
    }
}
