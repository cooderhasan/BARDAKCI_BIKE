const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        console.log("Fetching last 10 orders of any source...");
        const orders = await prisma.order.findMany({
            take: 10,
            orderBy: { createdAt: "desc" },
        });

        console.log(JSON.stringify(orders.map(o => ({
            id: o.id,
            orderNumber: o.orderNumber,
            source: o.source,
            total: o.total,
            invoiceId: o.invoiceId,
            invoiceNo: o.invoiceNo,
            invoiceStatus: o.invoiceStatus,
            invoiceUrl: o.invoiceUrl,
            createdAt: o.createdAt
        })), null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

run();
