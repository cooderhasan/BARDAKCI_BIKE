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
        
        console.log(`📡 Hepsiburada API'sine bağlanılıyor...`);
        console.log(`🔗 URL: ${baseUrl}/listings/merchantid/${merchantId}`);
        
        const pair = `${username}:${password}`;
        const authHeader = `Basic ${Buffer.from(pair).toString("base64")}`;
        
        const response = await fetch(`${baseUrl}/listings/merchantid/${merchantId}?limit=500&offset=0`, {
            method: "GET",
            headers: {
                "Authorization": authHeader,
                "Accept": "application/json",
                "Content-Type": "application/json",
                "User-Agent": "serinmotor_dev"
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ HB API Hatası: ${response.status} - ${errorText}`);
            return;
        }

        const data = await response.json();
        const listings = data?.listings || data?.items || (Array.isArray(data) ? data : []);
        
        console.log(`\n📋 Hepsiburada'dan ${listings.length} adet ilan çekildi.`);
        
        const targetSku = "HBCV000007MQETQ";
        console.log(`\n🔍 '${targetSku}' kodu ile ilgili ilanlar aranıyor...`);
        
        const matched = listings.filter(l => 
            l.hepsiburadaSku === targetSku || 
            l.merchantSku === targetSku ||
            (l.merchantSku && l.merchantSku.toLowerCase().includes(targetSku.toLowerCase()))
        );

        if (matched.length === 0) {
            console.log(`❌ Hepsiburada'dan gelen 500 ilanın içinde '${targetSku}' kodlu hiçbir ilan BULUNAMADI!`);
            
            // İlk 5 ilanı örnek olarak yazdıralım
            console.log("\n💡 Örnek İlk 5 İlan:");
            listings.slice(0, 5).forEach((l, index) => {
                console.log(`[${index + 1}] hepsiburadaSku: "${l.hepsiburadaSku}", merchantSku: "${l.merchantSku}"`);
            });
        } else {
            console.log(`\n✅ Eşleşen ilanlar bulundu (Toplam: ${matched.length}):`);
            console.log(JSON.stringify(matched, null, 2));
        }

    } catch (e) {
        console.error("Hata:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
