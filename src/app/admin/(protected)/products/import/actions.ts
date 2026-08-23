"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";

interface ImportRow {
    "Ürün Adı (Zorunlu)"?: string;
    "Ürün Adı"?: string;
    "Liste Fiyatı (TL)"?: number | string;
    "Liste Fiyatı (Zorunlu)"?: number | string;
    "Liste Fiyatı"?: number | string;
    "Satış Fiyatı (TL)"?: number | string;
    "Satış Fiyatı"?: number | string;
    "Trendyol Fiyatı (TL)"?: number | string;
    "Trendyol Fiyatı"?: number | string;
    "N11 Fiyatı (TL)"?: number | string;
    "N11 Fiyatı"?: number | string;
    "Hepsiburada Fiyatı (TL)"?: number | string;
    "Hepsiburada Fiyatı"?: number | string;
    "Pazarama Fiyatı (TL)"?: number | string;
    "Pazarama Fiyatı"?: number | string;
    "ePttAVM Fiyatı (TL)"?: number | string;
    "ePttAVM Fiyatı"?: number | string;
    "Çiçeksepeti Fiyatı (TL)"?: number | string;
    "Çiçeksepeti Fiyatı"?: number | string;
    "Kategori Slug (Zorunlu)"?: string;
    "Kategori Slug"?: string;
    "Stok Kodu"?: string;
    "Barkod"?: string;
    "Desi"?: number | string;
    "Desi (Kg)"?: number | string;
    "Açıklama"?: string;
    "Stok Adedi"?: number | string;
    "KDV Oranı (%)"?: number | string;
    "Minimum Sipariş"?: number | string;
    "Kritik Stok"?: number | string;
    "Marka Slug"?: string;
    "Menşei"?: string;
    "Öne Çıkan (1/0)"?: number | string;
    "Yeni Ürün (1/0)"?: number | string;
    "Çok Satan (1/0)"?: number | string;
}

interface ParseResult {
    totalCount: number;
    rows: any[];
    errors: { row: number; message: string }[];
}

interface ImportResult {
    success: boolean;
    created: number;
    updated: number;
    errors: { row: number; message: string }[];
}

function getValue(row: Record<string, any>, possibleKeys: string[]): any {
    if (!row) return undefined;
    for (const key of possibleKeys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
            return row[key];
        }
    }
    const rowKeys = Object.keys(row);
    for (const pKey of possibleKeys) {
        const normPKey = pKey.toLowerCase().replace(/[^a-z0-9]/g, "");
        const foundKey = rowKeys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, "") === normPKey);
        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== "") {
            return row[foundKey];
        }
    }
    return undefined;
}

function parseNumber(val: any): number | null {
    if (val === undefined || val === null || val === "") return null;
    if (typeof val === "number") return isNaN(val) ? null : val;
    const strVal = String(val).replace(",", ".").trim();
    const parsed = parseFloat(strVal);
    return isNaN(parsed) ? null : parsed;
}

function generateSlug(text: string): string {
    if (!text) return "";

    const turkishChars: Record<string, string> = {
        'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
        'Ç': 'c', 'Ğ': 'g', 'I': 'i', 'İ': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u',
    };

    return text
        .normalize('NFC')
        .replace(/[çğıöşüÇĞIİÖŞÜ]/g, (char) => turkishChars[char] || char)
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

export async function parseExcelFile(formData: FormData): Promise<ParseResult> {
    const file = formData.get("file") as File;

    if (!file) {
        return { totalCount: 0, rows: [], errors: [{ row: 0, message: "Dosya bulunamadı" }] };
    }

    try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "buffer" });

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet);
        const errors: { row: number; message: string }[] = [];
        const previewRows: any[] = [];
        let validCount = 0;

        // Filter and validate rows
        rawRows.forEach((row, index) => {
            const rowNum = index + 2; // Excel rows start at 1, plus header

            const name = getValue(row, ["Ürün Adı (Zorunlu)", "Ürün Adı", "UrunAdi", "Ürün Ismi", "Name", "name"]);
            const sku = getValue(row, ["Stok Kodu", "Urun-Kodu", "Satıcı Stok Kodu", "Magaza Ürün Kodu", "SKU", "sku"]);
            const barcode = getValue(row, ["Barkod", "Barcode", "barkod", "barcode"]);
            const cat = getValue(row, ["Kategori Slug (Zorunlu)", "Kategori Slug", "Kategori", "Ürün Kategori Adı"]);

            // Skip completely empty rows
            const hasAnyData = Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== "");
            if (!hasAnyData) return;

            validCount++;

            // A row is valid if it has at least a Name OR SKU/Barcode to identify the product
            if (!name && !sku && !barcode) {
                errors.push({ row: rowNum, message: "Ürün adı, Stok Kodu veya Barkod zorunludur" });
            }

            // Standardized preview row format for client table
            if (previewRows.length < 10) {
                previewRows.push({
                    "Ürün Adı (Zorunlu)": name || "-",
                    "Liste Fiyatı (Zorunlu)": getValue(row, ["Liste Fiyatı (TL)", "Liste Fiyatı (Zorunlu)", "Liste Fiyatı", "Eticaret Fiyatı", "Fiyat"]) || "-",
                    "Kategori Slug (Zorunlu)": cat || "-",
                    "Stok Kodu": sku || "-",
                    "Barkod": barcode || "-",
                    "Desi": getValue(row, ["Desi", "Desi (Kg)", "Desi(Kg)", "Ürün Desi", "desi"]) || "-",
                    "Stok Adedi": getValue(row, ["Stok Adedi", "Ürün Adedi", "Stok", "stok"]) ?? 0
                });
            }
        });

        return {
            totalCount: validCount,
            rows: previewRows, // Send only preview rows to prevent payload limit overflow
            errors: errors.slice(0, 100) // Max 100 errors preview
        };
    } catch (error: any) {
        console.error("Excel parse error:", error);
        return { totalCount: 0, rows: [], errors: [{ row: 0, message: `Dosya okunamadı: ${error?.message || error}` }] };
    }
}

export async function importProducts(formData: FormData): Promise<ImportResult> {
    const file = formData.get("file") as File;

    if (!file) {
        return { success: false, created: 0, updated: 0, errors: [{ row: 0, message: "Dosya bulunamadı" }] };
    }

    try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet);

        let created = 0;
        let updated = 0;
        const errors: { row: number; message: string }[] = [];

        // Pre-fetch all categories, brands, and existing SKUs/Barcodes
        const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
        const brands = await prisma.brand.findMany({ select: { id: true, slug: true } });
        const existingProducts = await prisma.product.findMany({
            select: { id: true, sku: true, barcode: true, name: true, desi: true, categoryId: true, brandId: true, listPrice: true }
        });

        const categoryMap = new Map(categories.map(c => [c.slug.toLowerCase(), c.id]));
        const brandMap = new Map(brands.map(b => [b.slug.toLowerCase(), b.id]));
        
        const productBySkuMap = new Map<string, typeof existingProducts[0]>();
        const productByBarcodeMap = new Map<string, typeof existingProducts[0]>();
        existingProducts.forEach(p => {
            if (p.sku) productBySkuMap.set(p.sku.trim().toLowerCase(), p);
            if (p.barcode) productByBarcodeMap.set(p.barcode.trim().toLowerCase(), p);
        });

        const BATCH_SIZE = 100;
        let pendingQueries: any[] = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2;

            const hasAnyData = Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== "");
            if (!hasAnyData) continue;

            try {
                const name = getValue(row, ["Ürün Adı (Zorunlu)", "Ürün Adı", "UrunAdi", "Ürün Ismi", "Name", "name"]);
                const listPrice = parseNumber(getValue(row, ["Liste Fiyatı (TL)", "Liste Fiyatı (Zorunlu)", "Liste Fiyatı", "Eticaret Fiyatı", "Fiyat"]));
                const categorySlug = getValue(row, ["Kategori Slug (Zorunlu)", "Kategori Slug", "Kategori", "Ürün Kategori Adı"]);

                const skuRaw = getValue(row, ["Stok Kodu", "Urun-Kodu", "Satıcı Stok Kodu", "Magaza Ürün Kodu", "SKU", "sku"]);
                const barcodeRaw = getValue(row, ["Barkod", "Barcode", "barkod", "barcode"]);

                const sku = skuRaw ? String(skuRaw).trim() : null;
                const barcode = barcodeRaw ? String(barcodeRaw).trim() : null;

                const skuKey = sku ? sku.toLowerCase() : null;
                const barcodeKey = barcode ? barcode.toLowerCase() : null;

                // Fast map lookup
                let existingProduct: typeof existingProducts[0] | undefined = undefined;
                if (skuKey && productBySkuMap.has(skuKey)) {
                    existingProduct = productBySkuMap.get(skuKey);
                } else if (barcodeKey && productByBarcodeMap.has(barcodeKey)) {
                    existingProduct = productByBarcodeMap.get(barcodeKey);
                }

                if (!existingProduct && (!name || listPrice === null || !categorySlug)) {
                    errors.push({ row: rowNum, message: "Yeni ürün eklemek için (İsim, Fiyat, Kategori) alanları zorunludur" });
                    continue;
                }

                const catSlugClean = categorySlug ? String(categorySlug).trim().toLowerCase() : null;
                const brandSlugClean = getValue(row, ["Marka Slug", "Marka"]) ? String(getValue(row, ["Marka Slug", "Marka"])).trim().toLowerCase() : null;

                const categoryId = catSlugClean ? categoryMap.get(catSlugClean) : existingProduct?.categoryId;
                const brandId = brandSlugClean ? brandMap.get(brandSlugClean) : existingProduct?.brandId;

                const slug = generateSlug(name || existingProduct?.name || "urun") + "-" + Date.now().toString(36);
                const parsedDesi = parseNumber(getValue(row, ["Desi", "Desi (Kg)", "Desi(Kg)", "Ürün Desi", "desi"]));
                const desiVal = parsedDesi !== null ? Math.max(0.01, parsedDesi) : (existingProduct?.desi ?? 1);

                const finalPrice = listPrice !== null ? listPrice : (existingProduct?.listPrice ? Number(existingProduct.listPrice) : 0);
                const salePrice = parseNumber(getValue(row, ["Satış Fiyatı (TL)", "Satış Fiyatı", "İndirimli Fiyat"])) ?? finalPrice;
                const trendyolPrice = parseNumber(getValue(row, ["Trendyol Fiyatı (TL)", "Trendyol Fiyatı", "Trendyol Satış Fiyatı"]));
                const n11Price = parseNumber(getValue(row, ["N11 Fiyatı (TL)", "N11 Fiyatı", "N11 Satış Fiyatı"]));
                const hepsiburadaPrice = parseNumber(getValue(row, ["Hepsiburada Fiyatı (TL)", "Hepsiburada Fiyatı", "HepsiBurada Satış Fiyatı"]));
                const pazaramaPrice = parseNumber(getValue(row, ["Pazarama Fiyatı (TL)", "Pazarama Fiyatı", "Pazarama Satış Fiyatı"]));
                const pttavmPrice = parseNumber(getValue(row, ["ePttAVM Fiyatı (TL)", "ePttAVM Fiyatı", "Eptt Liste Fiyatı"]));
                const ciceksepetiPrice = parseNumber(getValue(row, ["Çiçeksepeti Fiyatı (TL)", "Çiçeksepeti Fiyatı"]));

                const stockVal = parseNumber(getValue(row, ["Stok Adedi", "Ürün Adedi", "Stok", "stok"]));
                const descVal = getValue(row, ["Açıklama", "UrunAciklamasi", "Description"]);

                const productData: any = {
                    ...(name && { name }),
                    ...(listPrice !== null && { listPrice: finalPrice }),
                    ...(salePrice !== null && { salePrice }),
                    ...(categoryId && { categoryId }),
                    ...(brandId && { brandId }),
                    ...(sku && { sku }),
                    ...(barcode && { barcode }),
                    ...(parsedDesi !== null && { desi: desiVal }),
                    ...(trendyolPrice !== null && { trendyolPrice }),
                    ...(n11Price !== null && { n11Price }),
                    ...(hepsiburadaPrice !== null && { hepsiburadaPrice }),
                    ...(pazaramaPrice !== null && { pazaramaPrice }),
                    ...(pttavmPrice !== null && { pttavmPrice }),
                    ...(ciceksepetiPrice !== null && { ciceksepetiPrice }),
                    ...(descVal && { description: String(descVal) }),
                    ...(stockVal !== null && { stock: stockVal }),
                    ...(parseNumber(getValue(row, ["Kritik Stok"])) !== null && { criticalStock: parseNumber(getValue(row, ["Kritik Stok"])) }),
                    ...(parseNumber(getValue(row, ["KDV Oranı (%)", "KDV", "Kdv"])) !== null && { vatRate: parseNumber(getValue(row, ["KDV Oranı (%)", "KDV", "Kdv"])) }),
                    ...(parseNumber(getValue(row, ["Minimum Sipariş"])) !== null && { minQuantity: parseNumber(getValue(row, ["Minimum Sipariş"])) }),
                    ...(getValue(row, ["Menşei"]) && { origin: String(getValue(row, ["Menşei"])) }),
                    ...(parseNumber(getValue(row, ["Öne Çıkan (1/0)"])) !== null && { isFeatured: parseNumber(getValue(row, ["Öne Çıkan (1/0)"])) === 1 }),
                    ...(parseNumber(getValue(row, ["Yeni Ürün (1/0)"])) !== null && { isNew: parseNumber(getValue(row, ["Yeni Ürün (1/0)"])) === 1 }),
                    ...(parseNumber(getValue(row, ["Çok Satan (1/0)"])) !== null && { isBestSeller: parseNumber(getValue(row, ["Çok Satan (1/0)"])) === 1 }),
                    ...(parseNumber(getValue(row, ["Ücretsiz Kargo (1/0)", "Ücretsiz Kargo", "isFreeShipping"])) !== null && { isFreeShipping: parseNumber(getValue(row, ["Ücretsiz Kargo (1/0)", "Ücretsiz Kargo", "isFreeShipping"])) === 1 }),
                };

                if (existingProduct) {
                    pendingQueries.push(
                        prisma.product.update({
                            where: { id: existingProduct.id },
                            data: productData
                        })
                    );
                    updated++;
                } else {
                    pendingQueries.push(
                        prisma.product.create({
                            data: {
                                name: name!,
                                listPrice: finalPrice,
                                salePrice: salePrice,
                                categoryId: categoryId!,
                                brandId: brandId || null,
                                sku: sku,
                                barcode: barcode,
                                desi: desiVal,
                                ...productData,
                                slug: slug,
                                images: [],
                                isActive: true,
                            }
                        })
                    );
                    created++;
                }

                if (pendingQueries.length >= BATCH_SIZE) {
                    await prisma.$transaction(pendingQueries);
                    pendingQueries = [];
                }
            } catch (error) {
                console.error(`Row ${rowNum} error:`, error);
                errors.push({ row: rowNum, message: "Kayıt hatası" });
            }
        }

        if (pendingQueries.length > 0) {
            await prisma.$transaction(pendingQueries);
        }

        revalidatePath("/admin/products");

        return {
            success: errors.length === 0,
            created,
            updated,
            errors
        };
    } catch (error: any) {
        console.error("Import error:", error);
        return {
            success: false,
            created: 0,
            updated: 0,
            errors: [{ row: 0, message: `Aktarım hatası: ${error?.message || error}` }]
        };
    }
}
