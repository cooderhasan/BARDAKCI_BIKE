import { prisma } from "../src/lib/db";
import XLSX from "xlsx";

export async function fastBatchImportN11(buffer?: Buffer) {
    console.time("FastImport");
    let rows: any[] = [];
    if (buffer) {
        const wb = XLSX.read(buffer, { type: "buffer" });
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as any[];
    } else {
        const wb = XLSX.readFile("n11.xlsx");
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as any[];
    }

    const localProducts = await prisma.product.findMany({
        select: { id: true, sku: true, isN11Active: true }
    });

    const skuMap = new Map<string, typeof localProducts[0]>();
    localProducts.forEach(p => {
        if (p.sku) skuMap.set(p.sku.trim().toLowerCase(), p);
    });

    const existingN11 = await (prisma as any).n11Product.findMany({
        select: { id: true, productId: true }
    });
    const existingMap = new Map<string, any>();
    existingN11.forEach((e: any) => existingMap.set(e.productId, e));

    const updates: any[] = [];
    const creates: any[] = [];
    const productIdsToActivate: string[] = [];

    for (const row of rows) {
        const excelSku = (row["Urun-Kodu"] || row["Ürün Kodu"] || row["Stok Kodu"] || "").toString().trim().toLowerCase();
        const n11SellerCode = (row["N11-Entegrasyon-Kodu"] || row["Entegrasyon Kodu"] || row["Magaza Ürün Kodu"] || "").toString().trim();
        const n11Id = row["N11-ilan-id"] || row["N11 İlan ID"] || row["IlanId"] ? String(row["N11-ilan-id"] || row["N11 İlan ID"] || row["IlanId"]).trim() : null;

        const match = skuMap.get(excelSku);

        if (match && n11SellerCode) {
            const existing = existingMap.get(match.id);
            if (existing) {
                updates.push((prisma as any).n11Product.update({
                    where: { id: existing.id },
                    data: {
                        sellerCode: n11SellerCode,
                        n11Id: n11Id,
                        isSynced: true,
                        lastSyncedAt: new Date()
                    }
                }));
            } else {
                creates.push({
                    productId: match.id,
                    sellerCode: n11SellerCode,
                    n11Id: n11Id,
                    isSynced: true,
                    lastSyncedAt: new Date()
                });
            }

            if (!match.isN11Active) {
                productIdsToActivate.push(match.id);
            }
        }
    }

    if (creates.length > 0) {
        await (prisma as any).n11Product.createMany({
            data: creates,
            skipDuplicates: true
        });
    }

    if (updates.length > 0) {
        const CHUNK_SIZE = 100;
        for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
            await prisma.$transaction(updates.slice(i, i + CHUNK_SIZE));
        }
    }

    if (productIdsToActivate.length > 0) {
        await prisma.product.updateMany({
            where: { id: { in: productIdsToActivate } },
            data: { isN11Active: true }
        });
    }

    console.timeEnd("FastImport");
    console.log(`Fast Import Done! Creates: ${creates.length}, Updates: ${updates.length}`);
    return { created: creates.length, updated: updates.length };
}

if (require.main === module) {
    fastBatchImportN11().then(() => process.exit(0));
}
