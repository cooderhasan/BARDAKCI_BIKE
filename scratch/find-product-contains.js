const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { sku: { contains: "1118492" } },
          { id: { contains: "1118492" } },
          { name: { contains: "1118492" } }
        ]
      },
      include: { categories: true }
    });
    console.log(`Found ${products.length} products:`);
    products.forEach(p => {
      console.log(JSON.stringify(p, null, 2));
    });
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
