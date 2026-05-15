const https = require('https');

async function getProductDetails() {
  const merchantId = '2c8b04a9-3898-4925-99a5-98875224b436';
  const secretKey = 'xraAz49GJu29';
  const auth = 'Basic ' + Buffer.from(`${merchantId}:${secretKey}`).toString('base64');
  const merchantSku = '8660802687527'; // Test Ürünü 006

  const options = {
    hostname: 'mpop-sit.hepsiburada.com',
    port: 443,
    path: `/product/api/products/search?merchantSku=${merchantSku}`,
    method: 'GET',
    headers: {
      'Authorization': auth,
      'Accept': 'application/json',
      'User-Agent': 'serinmotor_dev'
    }
  };

  console.log('Searching product:', merchantSku);

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
}

getProductDetails();
