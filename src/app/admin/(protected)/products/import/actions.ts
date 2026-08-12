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
    rows: ImportRow[];
    errors: { row: number; message: string }[];
}

interface ImportResult {
    success: boolean;
    created: number;
    updated: number;
    errors: { row: number; message: string }[];
}

function parseNumber(val: any): number | null {
    if (val === undefined || val === null || val === "") return null;
    if (typeof val === "number") return val;
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
        return { rows: [], errors: [{ row: 0, message: "Dosya bulunamadı" }] };
    }

    try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "buffer" });

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const rows: ImportRow[] = XLSX.utils.sheet_to_json(worksheet);
        const errors: { row: number; message: string }[] = [];

        // Validate each row
        rows.forEach((row, index) => {
            const rowNum = index + 2; // Excel rows start at 1, plus header

            const name = row["Ürün Adı (Zorunlu)"] || row["Ürün Adı"];
            const price = parseNumber(row["Liste Fiyatı (TL)"] ?? row["Liste Fiyatı (Zorunlu)"] ?? row["Liste Fiyatı"]);
            const cat = row["Kategori Slug (Zorunlu)"] || row["Kategori Slug"];

            if (!name) {
                errors.push({ row: rowNum, message: "Ürün adı zorunludur" });
            }
            if (price === null) {
                errors.push({ row: rowNum, message: "Geçerli bir liste fiyatı giriniz" });
            }
            if (!cat) {
                errors.push({ row: rowNum, message: "Kategori slug zorunludur" });
            }
        });

        return { rows, errors };
    } catch (error) {
        console.error("Excel parse error:", error);
        return { rows: [], errors: [{ row: 0, message: "Dosya okunamadı" }] };
    }
}

export async function importProducts(formData: FormData): Promise<ImportResult> {
    const file = formData.get("file") as File;

    if (!file) {
        return { success: false, created: 0, updated: 0, errors: [{ row: 0, message: "Dosya bulunamadı" }] };
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows: ImportRow[] = XLSX.utils.sheet_to_json(worksheet);

    let created = 0;
    let updated = 0;
    const errors: { row: number; message: string }[] = [];

    // Pre-fetch all categories, brands, and existing SKUs for ultra-fast lookup
    const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
    const brands = await prisma.brand.findMany({ select: { id: true, slug: true } });
    const existingProducts = await prisma.product.findMany({ select: { id: true, sku: true, barcode: true, desi: true } });

    const categoryMap = new Map(categories.map(c => [c.slug, c.id]));
    const brandMap = new Map(brands.map(b => [b.slug, b.id]));
    
    // Map existing products by SKU and Barcode
    const productBySkuMap = new Map();
    const productByBarcodeMap = new Map();
    existingProducts.forEach(p => {
        if (p.sku) productBySkuMap.set(p.sku.trim(), p);
        if (p.barcode) productByBarcodeMap.set(p.barcode.trim(), p);
    });

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;

        try {
            const name = row["Ürün Adı (Zorunlu)"] || row["Ürün Adı"];
            const listPrice = parseNumber(row["Liste Fiyatı (TL)"] ?? row["Liste Fiyatı (Zorunlu)"] ?? row["Liste Fiyatı"]);
            const categorySlug = row["Kategori Slug (Zorunlu)"] || row["Kategori Slug"];

            if (!name || listPrice === null || !categorySlug) {
                errors.push({ row: rowNum, message: "Zorunlu alanlar eksik" });
                continue;
            }

            const categoryId = categoryMap.get(categorySlug);
            if (!categoryId) {
                errors.push({ row: rowNum, message: `Kategori bulunamadı: ${categorySlug}` });
                continue;
            }

            const brandSlug = row["Marka Slug"];
            const brandId = brandSlug ? brandMap.get(brandSlug) : null;

            const slug = generateSlug(name) + "-" + Date.now().toString(36);
            const sku = row["Stok Kodu"] ? String(row["Stok Kodu"]).trim() : null;
            const barcode = row["Barkod"] ? String(row["Barkod"]).trim() : null;

            // Fast map lookup
            let existingProduct: any = null;
            if (sku && productBySkuMap.has(sku)) {
                existingProduct = productBySkuMap.get(sku);
            } else if (barcode && productByBarcodeMap.has(barcode)) {
                existingProduct = productByBarcodeMap.get(barcode);
            }

            const parsedDesi = parseNumber(row["Desi"] ?? row["Desi (Kg)"]);
            const desiVal = parsedDesi !== null ? Math.max(0.01, parsedDesi) : (existingProduct?.desi ?? 1);

            const salePrice = parseNumber(row["Satış Fiyatı (TL)"] ?? row["Satış Fiyatı"]) ?? listPrice;
            const trendyolPrice = parseNumber(row["Trendyol Fiyatı (TL)"] ?? row["Trendyol Fiyatı"]);
            const n11Price = parseNumber(row["N11 Fiyatı (TL)"] ?? row["N11 Fiyatı"]);
            const hepsiburadaPrice = parseNumber(row["Hepsiburada Fiyatı (TL)"] ?? row["Hepsiburada Fiyatı"]);
            const pazaramaPrice = parseNumber(row["Pazarama Fiyatı (TL)"] ?? row["Pazarama Fiyatı"]);
            const pttavmPrice = parseNumber(row["ePttAVM Fiyatı (TL)"] ?? row["ePttAVM Fiyatı"]);
            const ciceksepetiPrice = parseNumber(row["Çiçeksepeti Fiyatı (TL)"] ?? row["Çiçeksepeti Fiyatı"]);

            const productData: any = {
                name: name,
                listPrice: listPrice,
                salePrice: salePrice,
                categoryId: categoryId,
                brandId: brandId || null,
                sku: sku,
                barcode: barcode,
                desi: desiVal,
                ...(trendyolPrice !== null && { trendyolPrice }),
                ...(n11Price !== null && { n11Price }),
                ...(hepsiburadaPrice !== null && { hepsiburadaPrice }),
                ...(pazaramaPrice !== null && { pazaramaPrice }),
                ...(pttavmPrice !== null && { pttavmPrice }),
                ...(ciceksepetiPrice !== null && { ciceksepetiPrice }),
                description: row["Açıklama"] ? String(row["Açıklama"]) : null,
                stock: parseNumber(row["Stok Adedi"]) ?? 0,
                criticalStock: parseNumber(row["Kritik Stok"]) ?? 10,
                vatRate: parseNumber(row["KDV Oranı (%)"]) ?? 20,
                minQuantity: parseNumber(row["Minimum Sipariş"]) ?? 1,
                origin: row["Menşei"] ? String(row["Menşei"]) : null,
                isFeatured: parseNumber(row["Öne Çıkan (1/0)"]) === 1,
                isNew: parseNumber(row["Yeni Ürün (1/0)"]) === 1,
            };

            if (existingProduct) {
                // Update existing product
                await prisma.product.update({
                    where: { id: existingProduct.id },
                    data: productData
                });
                updated++;
            } else {
                // Create new product
                await prisma.product.create({
                    data: {
                        ...productData,
                        slug: slug,
                        images: [],
                        isActive: true,
                    }
                });
                created++;
            }
        } catch (error) {
            console.error(`Row ${rowNum} error:`, error);
            errors.push({ row: rowNum, message: "Kayıt hatası" });
        }
    }

    revalidatePath("/admin/products");

    return {
        success: errors.length === 0,
        created,
        updated,
        errors
    };
}
