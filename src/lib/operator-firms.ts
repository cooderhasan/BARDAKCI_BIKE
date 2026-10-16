import { prisma } from "@/lib/db";
import type { OperatorFirmInfo, ProductOperators } from "@/lib/operator-fields";

const pick = (f: { name: string; address: string; email: string } | null | undefined): OperatorFirmInfo | null =>
    f ? { name: f.name, address: f.address, email: f.email } : null;

/** Ürünün markasına tanımlı imalatçı / ithalatçı firmaları (tanımlı değilse null) */
export async function productOperatorsOf(productId: string): Promise<ProductOperators> {
    const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { brand: { select: { manufacturerFirm: true, importerFirm: true } } },
    });
    return {
        manufacturer: pick(product?.brand?.manufacturerFirm),
        importer: pick(product?.brand?.importerFirm),
    };
}

/** Çiçeksepeti operatorContacts biçimi: 1 = İmalatçı, 2 = İthalatçı */
export function ciceksepetiOperatorContacts(ops: ProductOperators) {
    const out: { type: number; name: string; address: string; email: string }[] = [];
    if (ops.manufacturer) out.push({ type: 1, ...ops.manufacturer });
    if (ops.importer) out.push({ type: 2, ...ops.importer });
    return out;
}
