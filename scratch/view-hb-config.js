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
            // Remove quotes if present
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
        console.log("=== HEPSIBURADA CONFIG ===");
        const config = await prisma.hepsiburadaConfig.findFirst();
        console.log(JSON.stringify(config, null, 2));

        console.log("\n=== HEPSIBURADA PRODUCT FOR SKU HBCV000007MQETQ ===");
        const product = await prisma.hepsiburadaProduct.findFirst({
            where: { hbSku: "HBCV000007MQETQ" },
            include: { product: true }
        });
        console.log(JSON.stringify(product, null, 2));

    } catch (e) {
        console.error("Hata:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
