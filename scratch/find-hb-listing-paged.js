const fs = require('fs');
const path = require('path');

// Manually parse .env file
const envPath = path.join('d:', 'SRN', '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || '';
            if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
                value = value.substring(1, value.length - 1);
            }
            process.env[key] = value;
        }
    });
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const config = await prisma.hepsiburadaConfig.findFirst({ where: { isActive: true } });
        if (!config) {
            console.log("❌ Aktif Hepsiburada entegrasyonu bulunamadı.");
            return;
        }

        const username = config.username;
        const password = config.password;
        const merchantId = config.merchantId || username;
        const isTestMode = config.isTestMode ?? false;

        const sitSuffix = isTestMode ? "-sit" : "";
        const baseUrl = `https://listing-external${sitSuffix}.hepsiburada.com`;
        
        const pair = `${username}:${password}`;
        const authHeader = `Basic ${Buffer.from(pair).toString("base64")}`;
        
        const targetSku = "HBCV000007MQETQ";
        let allListings = [];
        let offset = 0;
        let limit = 100;
        let hasMore = true;

        console.log(`📡 Hepsiburada'daki TÜM sayfaları tarama işlemi başladı...`);
        console.log(`🔍 Hedef Kod: '${targetSku}'\n`);

        while (hasMore) {
            const url = `${baseUrl}/listings/merchantid/${merchantId}?limit=${limit}&offset=${offset}`;
            console.log(`📥 Sayfa çekiliyor: limit=${limit}, offset=${offset}...`);
            
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Authorization": authHeader,
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "User-Agent": "serinmotor_dev"
                }
            });

            if (!response.ok) {
                console.error(`❌ Sayfa çekilemedi (offset: ${offset}): ${response.status}`);
                break;
            }

            const data = await response.json();
            const pageListings = data?.listings || data?.items || (Array.isArray(data) ? data : []);
            
            if (pageListings.length === 0) {
                hasMore = false;
                break;
            }

            allListings.push(...pageListings);
            console.log(`   ✅ Bu sayfadan ${pageListings.length} adet ürün geldi. Toplam biriken: ${allListings.length}`);
            
            // Hedef ürünü bu sayfada kontrol et
            const matched = pageListings.filter(l => 
                l.hepsiburadaSku === targetSku || 
                l.merchantSku === targetSku ||
                (l.merchantSku && l.merchantSku.toLowerCase().includes(targetSku.toLowerCase()))
            );

            if (matched.length > 0) {
                console.log(`\n🎉 BİNGO! Hedef ürün bu sayfada bulundu!`);
                console.log(JSON.stringify(matched, null, 2));
                hasMore = false;
                break;
            }

            // Eğer gelen veri limitimizden azsa, son sayfadayız demektir
            if (pageListings.length < limit) {
                hasMore = false;
            } else {
                offset += limit;
            }
        }

        console.log(`\n🏁 Tarama tamamlandı. Toplam taranan ilan sayısı: ${allListings.length}`);
        
        const finalMatch = allListings.filter(l => 
            l.hepsiburadaSku === targetSku || 
            l.merchantSku === targetSku
        );

        if (finalMatch.length === 0) {
            console.log(`❌ Hepsiburada API'sinden dönen toplam ${allListings.length} ilanın hiçbirinde '${targetSku}' bulunamadı!`);
        }

    } catch (e) {
        console.error("Hata:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
