import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    const config = await prisma.hepsiburadaConfig.findFirst({ where: { isActive: true } });
    if (!config) throw new Error("No config");
    
    const token = Buffer.from(`${config.username}:${config.password}`).toString('base64');
    const headers = { 'Authorization': `Basic ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' };
    
    const merchantId = config.merchantId || config.username;
    
    // Try without beginDate
    let url1 = `https://oms-external.hepsiburada.com/orders/merchantid/${merchantId}?status=Packed&limit=100&offset=0`;
    console.log('Fetching', url1);
    let res1 = await fetch(url1, { headers });
    let data1 = await res1.json();
    console.log('Items without beginDate:', data1?.items?.length || data1?.length || 0);

    // Try with ISOString
    const beginDateStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    let url2 = `https://oms-external.hepsiburada.com/orders/merchantid/${merchantId}?status=Packed&limit=100&offset=0&beginDate=${encodeURIComponent(beginDateStr)}`;
    console.log('Fetching', url2);
    let res2 = await fetch(url2, { headers });
    let data2 = await res2.json();
    console.log('Items with ISOString:', data2?.items?.length || data2?.length || 0);

    // Try with YYYY-MM-DDTHH:mm:ss
    const beginDateFormatted = beginDateStr.substring(0, 19);
    let url3 = `https://oms-external.hepsiburada.com/orders/merchantid/${merchantId}?status=Packed&limit=100&offset=0&beginDate=${encodeURIComponent(beginDateFormatted)}`;
    console.log('Fetching', url3);
    let res3 = await fetch(url3, { headers });
    let data3 = await res3.json();
    console.log('Items with formatted date:', data3?.items?.length || data3?.length || 0);
    
    if (data3?.items?.length > 0) {
        console.log("Sample order:", data3.items[0].orderNumber);
    }
}
run().catch(console.error).finally(()=>prisma.$disconnect());
