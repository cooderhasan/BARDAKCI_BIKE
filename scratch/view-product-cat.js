const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const product = await prisma.product.findFirst({
      where: {
        OR: [
          { sku: { contains: "1118492" } },
          { id: { contains: "1118492" } }
        ]
      },
      include: { categories: true }
    });
    console.log("Product:", JSON.stringify(product, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
