import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStoreType, getStoreFilter } from "@/lib/store-helper";
import { findProductIdsBySearch, nameMatchesSearch } from "@/lib/product-search";

/**
 * Canlı arama önerileri (header arama kutusu): yazarken ilk ürünler + eşleşen kategoriler.
 * Arama mantığı ürünler sayfasıyla aynı (lib/product-search): Türkçe harf/ek duyarsız, marka ve varyant rengi dahil.
 * Sadece o mağazanın aktif ürünleri; stokta olanlar önce. Herkese açık, sadece okuma.
 */
export async function GET(req: NextRequest) {
    const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 80);
    if (q.length < 2) return NextResponse.json({ products: [], categories: [], total: 0 });

    const store = await getStoreType();
    const storeFilter = getStoreFilter(store) as any;
    try {
        const ids = (await findProductIdsBySearch(q, { stores: storeFilter.in, activeOnly: true })) || [];
        const where = { id: { in: ids } };
        const [inStock, outOfStock, total, allCategories] = await Promise.all([
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
            Promise.resolve(ids.length),
            // Kategori adları da Türkçe'ye uygun eşleşsin: mağazanın aktif kategorileri (birkaç yüz) bellekte süzülür
            prisma.category.findMany({
                where: { isActive: true, store: storeFilter },
                select: { name: true, slug: true },
                orderBy: { order: "asc" },
            }),
        ]);
        const categories = allCategories.filter((c) => nameMatchesSearch(c.name, q)).slice(0, 3);

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
