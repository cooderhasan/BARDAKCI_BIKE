const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const prod = await prisma.product.findFirst({
    where: { sku: 'KKLF013' },
    include: { hepsiburadaProducts: true, category: true }
  });
  console.log(JSON.stringify(prod, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
