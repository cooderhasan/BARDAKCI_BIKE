import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET() {
    try {
        // Create template data with headers and example row
        const templateData = [
            {
                "Ürün Adı (Zorunlu)": "Örnek Ürün",
                "Liste Fiyatı (Zorunlu)": 100.00,
                "Kategori Slug (Zorunlu)": "genel",
                "Stok Kodu": "STK001",
                "Barkod": "8690000000001",
                "Desi": 0.5,
                "Açıklama": "Ürün açıklaması buraya yazılır",
                "Stok Adedi": 50,
                "KDV Oranı (%)": 20,
                "Minimum Sipariş": 1,
                "Kritik Stok": 10,
                "Marka Slug": "marka-slug",
                "Menşei": "Türkiye",
                "Öne Çıkan (1/0)": 0,
                "Yeni Ürün (1/0)": 0,
                "Çok Satan (1/0)": 0,
            }
        ];

        // Create workbook and worksheet
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(templateData);

        // Set column widths
        worksheet["!cols"] = [
            { wch: 25 }, // Ürün Adı
            { wch: 15 }, // Liste Fiyatı
            { wch: 20 }, // Kategori Slug
            { wch: 15 }, // Stok Kodu
            { wch: 18 }, // Barkod
            { wch: 40 }, // Açıklama
            { wch: 12 }, // Stok Adedi
            { wch: 12 }, // KDV Oranı
            { wch: 15 }, // Minimum Sipariş
            { wch: 12 }, // Kritik Stok
            { wch: 15 }, // Marka Slug
            { wch: 12 }, // Menşei
            { wch: 15 }, // Öne Çıkan
            { wch: 15 }, // Yeni Ürün
            { wch: 12 }, // Çok Satan
        ];

        XLSX.utils.book_append_sheet(workbook, worksheet, "Ürünler");

        // Generate buffer
        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

        // Return Excel file
        return new NextResponse(buffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": "attachment; filename=urun-sablonu.xlsx"
            }
        });
    } catch (error) {
        console.error("Error generating template:", error);
        return NextResponse.json({ error: "Failed to generate template" }, { status: 500 });
    }
}
