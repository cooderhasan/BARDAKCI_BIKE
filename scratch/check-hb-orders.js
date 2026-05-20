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
        const orderBaseUrl = isTestMode 
            ? "https://ims-external-sit.hepsiburada.com" 
            : "https://ims-external.hepsiburada.com";

        const pair = `${username}:${password}`;
        const authHeader = `Basic ${Buffer.from(pair).toString("base64")}`;
        
        const statuses = ["New", "Approved", "Unacked", "Packed", "Shipped", "Delivered", "Cancelled", "UnDelivered"];
        console.log(`📡 Hepsiburada Sipariş Sorgulama Başladı... (Mağaza: ${merchantId})`);
        
        for (const status of statuses) {
            const url = `${orderBaseUrl}/orders/merchantid/${merchantId}?status=${status}&limit=50&offset=0`;
            console.log(`\n🔍 '${status}' durumundaki siparişler sorgulanıyor...`);
            
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
                console.error(`❌ Hata (${status}): ${response.status}`);
                continue;
            }

            const data = await response.json();
            const items = data?.items || [];
            console.log(`   ✅ Dönen Sipariş Sayısı: ${items.length}`);
            
            if (items.length > 0) {
                items.forEach((item, index) => {
                    console.log(`   👉 [Sipariş ${index + 1}]`);
                    console.log(`      No / ID: ${item.orderNumber || item.orderId || item.id}`);
                    console.log(`      Ürün Adı: ${item.name || item.productName}`);
                    console.log(`      Stok Kodu (merchantSku): ${item.merchantSku}`);
                    console.log(`      Katalog Kodu (sku): ${item.sku}`);
                    console.log(`      Müşteri: ${item.customerName || (item.shippingAddress && item.shippingAddress.name)}`);
                });
            }
        }

    } catch (e) {
        console.error("Hata:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
