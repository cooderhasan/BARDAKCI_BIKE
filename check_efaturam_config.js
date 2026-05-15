const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const config = await prisma.trendyolEFaturamConfig.findFirst();
  console.log(config);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
