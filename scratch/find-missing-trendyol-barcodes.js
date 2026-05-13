const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMissingBarcodes() {
    // Get Trendyol config
    const config = await prisma.trendyolConfig.findFirst();
    if (!config) {
        console.log('No active Trendyol config found.');
        return;
    }

    const auth = `Basic ${Buffer.from(config.apiKey + ':' + config.apiSecret).toString('base64')}`;
    const supplierId = config.supplierId;
    
    // Fetch last 100 orders from Trendyol
    console.log('Fetching orders from Trendyol...');
    const r = await fetch(`https://api.trendyol.com/sapigw/suppliers/${supplierId}/orders?size=100`, {
        headers: { 'Authorization': auth, 'User-Agent': supplierId }
    });
    const d = await r.json();
    
    if (!d.content) {
        console.log('No orders found or error:', d);
        return;
    }

    console.log(`Analyzing ${d.content.length} orders...`);
    let missingCount = 0;
    let missingBarcodes = new Set();

    for (const order of d.content) {
        for (const item of order.lines) {
            const barcode = item.barcode;
            // Check if this barcode exists in our Product or ProductVariant
            const product = await prisma.product.findFirst({ where: { barcode: barcode } });
            const variant = await prisma.productVariant.findFirst({ where: { barcode: barcode } });
            
            if (!product && !variant) {
                missingBarcodes.add(barcode);
                console.log(`[MISSING] Order: ${order.orderNumber} | Barcode: ${barcode} | Name: ${item.productName}`);
                missingCount++;
            }
        }
    }

    console.log(`\nFound ${missingBarcodes.size} unique missing barcodes in the last 100 orders.`);
    console.log('Unique Missing Barcodes:', Array.from(missingBarcodes));
}

checkMissingBarcodes().finally(() => prisma.$disconnect());
