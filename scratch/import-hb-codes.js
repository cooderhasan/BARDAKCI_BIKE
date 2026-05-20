const { PrismaClient } = require("@prisma/client");
const XLSX = require("xlsx");
const path = require("path");

const prisma = new PrismaClient();

async function importHepsiburadaCodes() {
    console.log("🚀 Hepsiburada Eşleşme Aktarım İşlemi Başlatıldı...");
    
    const filePath = path.join(__dirname, "../Satisbilgisi-18-05-2026-16_49.xlsx");
    const workbook = XLSX.readFile(filePath);
    const sheetName = "Listelerim";
    const sheet = workbook.Sheets[sheetName];
    
    const rows = XLSX.utils.sheet_to_json(sheet);
    console.log(`📊 Excel'den okunan toplam satır: ${rows.length}`);
    
    let createdCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    
    // Performans için veritabanı işlemlerini sırayla ve güvenli bir şekilde yapalım
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
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
                const updateData = {
                    isHepsiburadaActive: true
                };
                
                // Eğer ürünün barkodu boşsa ve Excel'de barkod varsa onu da sitemize kazandıralım
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
                
                if ((createdCount + updatedCount) % 100 === 0) {
                    console.log(`✨ İlerleme: ${createdCount + updatedCount} ürün başarıyla işlendi...`);
                }
            }
        } catch (err) {
            console.error(`❌ Hata (${saticiStokKodu}):`, err.message);
            errorCount++;
        }
    }
    
    console.log("\n==================================================");
    console.log("🎉 AKTARIM TAMAMLANDI!");
    console.log(`✅ Yeni Eşleşen/Eklenen Ürün: ${createdCount}`);
    console.log(`🔄 Güncellenen Eşleşme: ${updatedCount}`);
    console.log(`❌ Hatalı Satır: ${errorCount}`);
    console.log(`total: Toplam ${createdCount + updatedCount} ürün Hepsiburada'ya bağlandı!`);
    console.log("==================================================\n");
}

importHepsiburadaCodes()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
