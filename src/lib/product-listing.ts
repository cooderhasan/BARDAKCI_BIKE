import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Ürün listesi: stoktaki ürünler önce, tükenenler sonda (her grup kendi içinde istenen sırada).
 * Önceden "En Yeniler" sırası stoğa bakmıyordu; sayfanın başında "STOK TÜKENDİ" ürünler çıkıyordu.
 * Prisma'da ifadeyle sıralama olmadığı için iki grup ayrı sorgulanıp sayfa sınırında birleştirilir.
 */
export async function findProductsInStockFirst(args: {
    where: Prisma.ProductWhereInput;
    include: Prisma.ProductInclude;
    orderBy: Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[];
    skip: number;
    take: number;
}) {
    const { where, include, orderBy, skip, take } = args;
    const inStockWhere: Prisma.ProductWhereInput = { AND: [where, { stock: { gt: 0 } }] };
    const outOfStockWhere: Prisma.ProductWhereInput = { AND: [where, { stock: { lte: 0 } }] };

    const [inCount, outCount] = await Promise.all([
        prisma.product.count({ where: inStockWhere }),
        prisma.product.count({ where: outOfStockWhere }),
    ]);

    let products: any[] = [];
    if (skip < inCount) {
        products = await prisma.product.findMany({ where: inStockWhere, include, orderBy, skip, take });
        if (products.length < take && outCount > 0) {
            const rest = await prisma.product.findMany({ where: outOfStockWhere, include, orderBy, skip: 0, take: take - products.length });
            products = products.concat(rest);
        }
    } else {
        products = await prisma.product.findMany({ where: outOfStockWhere, include, orderBy, skip: skip - inCount, take });
    }

    return { products, totalCount: inCount + outCount };
}
