const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // We don't have the ID, let's search by SKU
    const p = await prisma.product.findFirst({
        where: { sku: '54119-1' }
    });
    if (p) {
        console.log("Product Images:", JSON.stringify(p.images, null, 2));
    } else {
        console.log("Product not found");
    }
}

main().finally(() => prisma.$disconnect());
