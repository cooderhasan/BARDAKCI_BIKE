const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const products = await prisma.product.findMany({
      take: 10,
      include: { categories: true }
    });
    console.log("Products sample:");
    products.forEach(p => {
      console.log(`- ID: ${p.id} | SKU: ${p.sku} | Name: ${p.name}`);
    });
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
