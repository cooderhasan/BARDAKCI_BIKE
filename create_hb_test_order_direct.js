const https = require('https');

async function createTestOrder() {
  const merchantId = '2c8b04a9-3898-4925-99a5-98875224b436';
  const secretKey = 'xraAz49GJu29';
  const auth = 'Basic ' + Buffer.from(`${merchantId}:${secretKey}`).toString('base64');
  
  // SIT test order payload
  const payload = {
    "merchantId": merchantId,
    "items": [
      {
        "merchantSku": "8660802687527", 
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
    path: '/orders',
    method: 'POST',
    headers: {
      'Authorization': auth,
      'Content-Type': 'application/json',
      'User-Agent': 'serinmotor_dev'
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
}

createTestOrder();
