const { PrismaClient } = require('@prisma/client');
const https = require('https');

const prisma = new PrismaClient();

async function createTestOrder() {
  try {
    const config = await prisma.hepsiburadaConfig.findFirst({ where: { isActive: true } });
    if (!config) { console.log('No active HB config'); return; }

    const auth = 'Basic ' + Buffer.from(`${config.username}:${config.password}`).toString('base64');
    
    // SIT test order payload
    const payload = {
      "items": [
        {
          "merchantSku": "8660802687527", // Our test product
          "quantity": 1,
          "price": 999.00
        }
      ],
      "customer": {
        "name": "Test Müşteri",
        "email": "test@example.com",
        "phone": "5551234567"
      },
      "shippingAddress": {
        "addressLine1": "Test Adresi No 1",
        "city": "İstanbul",
        "town": "Kadıköy"
      }
    };

    const options = {
      hostname: 'oms-external-sit.hepsiburada.com',
      port: 443,
      path: `/orders/merchantid/${config.merchantId}`,
      method: 'POST',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json',
        'User-Agent': 'bardakcibike_dev'
      }
    };

    console.log('Creating Test Order at:', options.path);

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

createTestOrder();
