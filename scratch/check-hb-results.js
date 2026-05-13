async function main() {
    const u = '2c8b04a9-3898-4925-99a5-98875224b436';
    const p = 'xraAz49GJu29';
    const auth = `Basic ${Buffer.from(u + ':' + p).toString('base64')}`;
    const trackingId = "fd04f455-14e8-4c36-98d9-cd4c741b9a7e";
    
    // Check results endpoint
    const r = await fetch(`https://mpop-sit.hepsiburada.com/product/api/products/import/results/${trackingId}`, {
        headers: {
            'Authorization': auth,
            'User-Agent': 'serinmotor_dev',
            'Accept': 'application/json'
        }
    });
    
    const d = await r.json();
    console.log(JSON.stringify(d, null, 2));
}

main();
