const https = require('https');

async function checkSyncStatus() {
  const merchantId = '2c8b04a9-3898-4925-99a5-98875224b436';
  const secretKey = 'xraAz49GJu29';
  const trackingId = '03d0ce7a-a8c9-4cf2-8c48-10a9d0587a3d';
  const auth = 'Basic ' + Buffer.from(`${merchantId}:${secretKey}`).toString('base64');
  
  const options = {
    hostname: 'listing-external-sit.hepsiburada.com',
    port: 443,
    path: `/listings/merchantid/${merchantId}/inventory-uploads/id/${trackingId}`,
    method: 'GET',
    headers: {
      'Authorization': auth,
      'Accept': 'application/json',
      'User-Agent': 'serinmotor_dev'
    }
  };

  console.log(`Checking status for tracking ID: ${trackingId}...`);

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

checkSyncStatus();
