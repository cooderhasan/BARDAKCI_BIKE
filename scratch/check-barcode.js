const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBarcode() {
    const barcode = '5134910053933';
    const product = await prisma.product.findFirst({ where: { barcode: barcode } });
    const variant = await prisma.productVariant.findFirst({ where: { barcode: barcode } });
    
    console.log('Barcode Search Result:');
    console.log(JSON.stringify({ product, variant }, null, 2));
}

checkBarcode().finally(() => prisma.$disconnect());
