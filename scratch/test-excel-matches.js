const { PrismaClient } = require("@prisma/client");
const XLSX = require("xlsx");
const path = require("path");

const prisma = new PrismaClient();

async function testMatches() {
    const filePath = path.join(__dirname, "../Satisbilgisi-18-05-2026-16_49.xlsx");
    const workbook = XLSX.readFile(filePath);
    const sheetName = "Listelerim";
    const sheet = workbook.Sheets[sheetName];
    
    // Satırları JSON objelerine dönüştür
    const rows = XLSX.utils.sheet_to_json(sheet);
    console.log(`Toplam Excel Satırı: ${rows.length}`);
    
    let matchedBySku = 0;
    let matchedByBarcode = 0;
    let notFound = 0;
    
    const sampleMatches = [];
    
    // İlk 20 tanesini detaylı kontrol edelim
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const saticiStokKodu = row["Satıcı Stok Kodu"] ? String(row["Satıcı Stok Kodu"]).trim() : null;
        const hbSku = row["SKU"] ? String(row["SKU"]).trim() : null;
        const barkod = row["Barkod"] ? String(row["Barkod"]).trim() : null;
        
        if (!saticiStokKodu) continue;
        
        // 1. SKU ile ara
        let product = await prisma.product.findUnique({
            where: { sku: saticiStokKodu }
        });
        
        if (product) {
            matchedBySku++;
            if (sampleMatches.length < 5) {
                sampleMatches.push({ saticiStokKodu, hbSku, barkod, matchedVia: "SKU", prodName: product.name });
            }
        } else {
            // 2. Barkod ile ara (fallback)
            if (barkod) {
                product = await prisma.product.findFirst({
                    where: { barcode: barkod }
                });
            }
            
            if (product) {
                matchedByBarcode++;
                if (sampleMatches.length < 5) {
                    sampleMatches.push({ saticiStokKodu, hbSku, barkod, matchedVia: "BARCODE", prodName: product.name });
                }
            } else {
                notFound++;
            }
        }
    }
    
    console.log(`SKU ile Eşleşen: ${matchedBySku}`);
    console.log(`Barkod ile Eşleşen: ${matchedByBarcode}`);
    console.log(`Eşleşmeyen: ${notFound}`);
    console.log("Örnek Eşleşmeler:", JSON.stringify(sampleMatches, null, 2));
}

testMatches()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
