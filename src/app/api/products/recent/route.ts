import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStoreType, getStoreFilter } from "@/lib/store-helper";

/**
 * "Son görüntülenenler" için güncel ürün bilgisi. Kimlikler müşterinin tarayıcısında tutuluyor; fiyat/stok burada güncel
 * alınır, satıştan kalkmış ya da başka mağazanın ürünü dönmez. Sıra, gönderilen kimlik sırasıyla aynı.
 */
export async function GET(req: NextRequest) {
    const ids = (req.nextUrl.searchParams.get("ids") || "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => /^[a-z0-9]{10,40}$/i.test(s))
        .slice(0, 12);
    if (ids.length === 0) return NextResponse.json({ products: [] });

    const store = await getStoreType();
    try {
        const rows = await prisma.product.findMany({
            where: { id: { in: ids }, isActive: true, store: getStoreFilter(store) as any },
            select: { id: true, name: true, slug: true, images: true, listPrice: true, salePrice: true, stock: true },
        });
        const byId = new Map(rows.map((r) => [r.id, r]));
        const products = ids
            .map((id) => byId.get(id))
            .filter(Boolean)
            .map((p: any) => {
                const sale = p.salePrice && Number(p.salePrice) > 0 ? Number(p.salePrice) : null;
                return {
                    id: p.id,
                    name: p.name,
                    slug: p.slug,
                    image: p.images?.[0] || null,
                    price: sale ?? Number(p.listPrice),
                    oldPrice: sale && sale < Number(p.listPrice) ? Number(p.listPrice) : null,
                    inStock: p.stock > 0,
                };
            });
        return NextResponse.json({ products });
    } catch (e) {
        console.error("recent products error:", e);
        return NextResponse.json({ products: [] });
    }
}
