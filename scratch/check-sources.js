const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        console.log("📡 Sipariş kaynaklarının dağılımı sorgulanıyor...");
        
        const sourceGroups = await prisma.order.groupBy({
            by: ['source'],
            _count: {
                id: true
            }
        });

        console.log("📊 Sipariş Kaynakları Dağılımı:");
        console.log(JSON.stringify(sourceGroups, null, 2));

        // En son eklenen 10 siparişi de getirerek ham veriyi inceleyelim
        const lastOrders = await prisma.order.findMany({
            orderBy: {
                createdAt: 'desc'
            },
            take: 10,
            select: {
                id: true,
                orderNumber: true,
                source: true,
                status: true,
                createdAt: true
            }
        });

        console.log("\n📋 Son 10 Siparişin Ham Verisi:");
        lastOrders.forEach(o => {
            console.log(`- #${o.orderNumber} (Kaynak: ${o.source}, Durum: ${o.status}, Tarih: ${o.createdAt})`);
        });

    } catch (error) {
        console.error("❌ Hata:", error);
    } finally {
        await prisma.$disconnect();
    }
}

run();
