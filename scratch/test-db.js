const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    try {
        const pCount = await prisma.product.count();
        console.log('Product count:', pCount);
        
        const tCount = await prisma.trendyolConfig.count();
        console.log('TrendyolConfig count:', tCount);
        
        const hCount = await prisma.hepsiburadaConfig.count();
        console.log('HepsiburadaConfig count:', hCount);
    } catch (e) {
        console.error('DB Error:', e.message);
    }
}

test().finally(() => prisma.$disconnect());
