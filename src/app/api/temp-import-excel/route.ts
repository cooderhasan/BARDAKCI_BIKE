import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";
import path from "path";

export async function GET() {
    try {
        console.log("🚀 Canlı Sunucuda Excel Aktarım API'si Çalıştırıldı...");
        
        // Excel dosyasını oku (public klasöründe yer almaktadır)
        const filePath = path.join(process.cwd(), "public", "Satisbilgisi-18-05-2026-16_49.xlsx");
        const workbook = XLSX.readFile(filePath);
        const sheetName = "Listelerim";
        const sheet = workbook.Sheets[sheetName];
        
        if (!sheet) {
            return NextResponse.json({ success: false, error: "'Listelerim' isimli Excel sayfası bulunamadı." });
        }
        
        const rows = XLSX.utils.sheet_to_json(sheet) as any[];
        
        let createdCount = 0;
        let updatedCount = 0;
        let errorCount = 0;
        let matchedBySku = 0;
        let matchedByBarcode = 0;
        
        // Veritabanı eşleştirmelerini tek tek işleyelim
        for (const row of rows) {
            const saticiStokKodu = row["Satıcı Stok Kodu"] ? String(row["Satıcı Stok Kodu"]).trim() : null;
            const hbSku = row["SKU"] ? String(row["SKU"]).trim() : null;
            const barkod = row["Barkod"] ? String(row["Barkod"]).trim() : null;
            
            if (!saticiStokKodu || !hbSku) continue;
            
            try {
                // 1. Ürünü SKU ile ara
                let product = await prisma.product.findUnique({
                    where: { sku: saticiStokKodu }
                });
                
                let matchedVia = "SKU";
                
                // 2. Bulunamadıysa barkod ile ara
                if (!product && barkod) {
                    product = await prisma.product.findFirst({
                        where: { barcode: barkod }
                    });
                    matchedVia = "BARCODE";
                }
                
                if (product) {
                    if (matchedVia === "SKU") matchedBySku++;
                    else matchedByBarcode++;
                    
                    // HepsiburadaProduct kaydını upsert et
                    const existingMapping = await prisma.hepsiburadaProduct.findUnique({
                        where: { productId: product.id }
                    });
                    
                    await prisma.hepsiburadaProduct.upsert({
                        where: { productId: product.id },
                        create: {
                            productId: product.id,
                            hbSku: hbSku,
                            merchantSku: saticiStokKodu,
                            isSynced: true,
                            lastSyncedAt: new Date()
                        },
                        update: {
                            hbSku: hbSku,
                            merchantSku: saticiStokKodu,
                            isSynced: true,
                            lastSyncedAt: new Date()
                        }
                    });
                    
                    // Ürünün kendisini güncelle (Hepsiburada'yı aktif et ve gerekirse barkodu yaz)
                    const updateData: any = {
                        isHepsiburadaActive: true
                    };
                    
                    if (!product.barcode && barkod) {
                        updateData.barcode = barkod;
                    }
                    
                    await prisma.product.update({
                        where: { id: product.id },
                        data: updateData
                    });
                    
                    if (existingMapping) {
                        updatedCount++;
                    } else {
                        createdCount++;
                    }
                }
            } catch (err: any) {
                console.error(`❌ Hata (${saticiStokKodu}):`, err.message);
                errorCount++;
            }
        }
        
        return NextResponse.json({
            success: true,
            message: "Excel eşleştirme aktarımı başarıyla tamamlandı!",
            stats: {
                totalExcelRows: rows.length,
                matchedBySku,
                matchedByBarcode,
                totalMatched: matchedBySku + matchedByBarcode,
                newMappingsCreated: createdCount,
                existingMappingsUpdated: updatedCount,
                errors: errorCount
            }
        });
        
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message });
    }
}
