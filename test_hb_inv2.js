const { PrismaClient } = require('@prisma/client');
const https = require('https');

const prisma = new PrismaClient();

async function pushInventoryDirect() {
  try {
    const config = await prisma.hepsiburadaConfig.findFirst();
    if (!config) { console.log('No HB config'); return; }

    const payload = [
      {
        "merchantSku": "SRN-8349909",
        "price": 650.00,
        "availableStock": 98,
        "dispatchTime": 3,
        "cargoCompany1": "Yurtici Kargo",
        "maximumPurchasableQuantity": 10
      }
    ];

    const auth = 'Basic ' + Buffer.from(`${config.username}:${config.password}`).toString('base64');

    const options = {
      hostname: 'listing-external-sit.hepsiburada.com',
      port: 443,
      path: `/listings/merchantid/${config.merchantId}/inventory-uploads`,
      method: 'POST',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json',
        'User-Agent': 'serinmotor_dev'
      }
    };

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

    req.write(JSON.stringify(payload));
    req.end();
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

pushInventoryDirect();
