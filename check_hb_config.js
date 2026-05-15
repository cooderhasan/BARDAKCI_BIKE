const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkConfigs() {
  const configs = await prisma.hepsiburadaConfig.findMany();
  console.log('Configs:', configs);
  await prisma.$disconnect();
}

checkConfigs();
