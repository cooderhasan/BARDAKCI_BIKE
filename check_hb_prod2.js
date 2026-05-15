const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const prod = await prisma.hepsiburadaProduct.findFirst({
    where: { hbSku: 'KKLF013' }
  });
  console.log(JSON.stringify(prod, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
