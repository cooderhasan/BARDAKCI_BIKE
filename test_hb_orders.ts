import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
    const orders = await prisma.order.findMany({where: {source: 'HEPSIBURADA'}, include: {items: true}});
    // We want to find orders that are probably partially imported.
    console.log('HB Orders:');
    for (const o of orders) {
        console.log(`Order: ${o.orderNumber}, Items: ${o.items.length}, Invoiced: ${!!o.invoiceNo}`);
    }
}
run().catch(console.error).finally(()=>prisma.$disconnect());
