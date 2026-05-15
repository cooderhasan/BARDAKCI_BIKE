const https = require('https');

async function sendInventory() {
  const payload = [
    {
      "merchantSku": "SRN-8349909",
      "price": "150,00",
      "availableStock": 50,
      "dispatchTime": 2,
      "cargoCompany1": "Yurtici Kargo",
      "maximumPurchasableQuantity": 5
    }
  ];

  const options = {
    hostname: 'listing-external-sit.hepsiburada.com',
    port: 443,
    path: '/listings/merchantid/2c8b04a9-3898-4925-99a5-98875224b436/inventory-uploads',
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from('2c8b04a9-3898-4925-99a5-98875224b436:xraAz49GJu29').toString('base64'),
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
}

sendInventory();
