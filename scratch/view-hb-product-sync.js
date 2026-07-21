const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const hbProduct = await prisma.hepsiburadaProduct.findFirst({
      where: { hbSku: "HBV000010L7XR" },
      include: { product: true }
    });
    console.log("Hepsiburada Product:", JSON.stringify(hbProduct, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
