const { HepsiburadaClient } = require('./src/services/hepsiburada/api');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testConn() {
  const config = await prisma.hepsiburadaConfig.findFirst({ where: { isActive: true } });
  const client = new HepsiburadaClient({
    username: config.username,
    password: config.password,
    merchantId: config.merchantId,
    isTestMode: true
  });
  const res = await client.checkConnectionDetailed();
  console.log('Result:', res);
  await prisma.$disconnect();
}

testConn();
