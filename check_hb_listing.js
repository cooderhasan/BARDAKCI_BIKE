const { PrismaClient } = require('@prisma/client');
const https = require('https');

const prisma = new PrismaClient();

async function checkListingStatus() {
  try {
    const config = await prisma.hepsiburadaConfig.findFirst();
    if (!config) { console.log('No HB config'); return; }

    const auth = 'Basic ' + Buffer.from(`${config.username}:${config.password}`).toString('base64');
    const merchantSku = '8660802687527'; // Test Urunu 006

    const options = {
      hostname: 'listing-external-sit.hepsiburada.com',
      port: 443,
      path: `/listings/merchantid/${config.merchantId}/sku/${merchantSku}`,
      method: 'GET',
      headers: {
        'Authorization': auth,
        'Accept': 'application/json',
        'User-Agent': 'serinmotor_dev'
      }
    };

    console.log('Fetching:', options.path);

    const req = https.request(options, res => {
      let d = '';
      res.on('data', chunk => { d += chunk; });
      res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', d);
      });
    });

    req.on('error', error => {
      console.error(error);
    });

    req.end();
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

checkListingStatus();
