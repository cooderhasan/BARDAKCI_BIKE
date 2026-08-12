import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";

export async function GET() {
    try {
        const products = await prisma.product.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                category: { select: { slug: true } },
                brand: { select: { slug: true } },
            },
        });

        const exportData = products.map((p) => {
            const listPrice = Number(p.listPrice || 0);
            const salePrice = Number(p.salePrice || listPrice);
            const trendyolPrice = Number(p.trendyolPrice || salePrice);
            const n11Price = Number(p.n11Price || salePrice);
            const hepsiburadaPrice = Number(p.hepsiburadaPrice || salePrice);
            const pazaramaPrice = Number(p.pazaramaPrice || salePrice);
            const pttavmPrice = Number(p.pttavmPrice || salePrice);
            const ciceksepetiPrice = Number(p.ciceksepetiPrice || salePrice);
            const desiVal = p.desi !== null && p.desi !== undefined ? Number(p.desi) : 1;

            return {
                "Stok Kodu": p.sku || "",
                "Barkod": p.barcode || "",
                "Ürün Adı (Zorunlu)": p.name,
                "Desi": desiVal,
                "Liste Fiyatı (TL)": listPrice,
                "Satış Fiyatı (TL)": salePrice,
                "Trendyol Fiyatı (TL)": trendyolPrice,
                "N11 Fiyatı (TL)": n11Price,
                "Hepsiburada Fiyatı (TL)": hepsiburadaPrice,
                "Pazarama Fiyatı (TL)": pazaramaPrice,
                "ePttAVM Fiyatı (TL)": pttavmPrice,
                "Çiçeksepeti Fiyatı (TL)": ciceksepetiPrice,
                "Stok Adedi": Number(p.stock || 0),
                "Kategori Slug (Zorunlu)": p.category?.slug || "genel",
                "Marka Slug": p.brand?.slug || "",
                "KDV Oranı (%)": Number(p.vatRate || 20),
                "Kritik Stok": Number(p.criticalStock || 10),
                "Minimum Sipariş": Number(p.minQuantity || 1),
                "Menşei": p.origin || "",
                "Öne Çıkan (1/0)": p.isFeatured ? 1 : 0,
                "Yeni Ürün (1/0)": p.isNew ? 1 : 0,
                "Çok Satan (1/0)": p.isBestSeller ? 1 : 0,
                "Açıklama": p.description || "",
            };
        });

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(exportData);

        worksheet["!cols"] = [
            { wch: 18 }, // Stok Kodu
            { wch: 18 }, // Barkod
            { wch: 35 }, // Ürün Adı
            { wch: 10 }, // Desi
            { wch: 15 }, // Liste Fiyatı
            { wch: 15 }, // Satış Fiyatı
            { wch: 18 }, // Trendyol Fiyatı
            { wch: 15 }, // N11 Fiyatı
            { wch: 18 }, // Hepsiburada Fiyatı
            { wch: 18 }, // Pazarama Fiyatı
            { wch: 18 }, // ePttAVM Fiyatı
            { wch: 18 }, // Çiçeksepeti Fiyatı
            { wch: 12 }, // Stok Adedi
            { wch: 22 }, // Kategori Slug
            { wch: 15 }, // Marka Slug
            { wch: 12 }, // KDV Oranı
            { wch: 12 }, // Kritik Stok
            { wch: 15 }, // Minimum Sipariş
            { wch: 12 }, // Menşei
            { wch: 15 }, // Öne Çıkan
            { wch: 15 }, // Yeni Ürün
            { wch: 12 }, // Çok Satan
            { wch: 40 }, // Açıklama
        ];

        XLSX.utils.book_append_sheet(workbook, worksheet, "Ürünler");

        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename=urunler-fiyat-ve-desi-listesi-${new Date().toISOString().split("T")[0]}.xlsx`,
            },
        });
    } catch (error) {
        console.error("Error exporting products:", error);
        return NextResponse.json({ error: "Failed to export products" }, { status: 500 });
    }
}
