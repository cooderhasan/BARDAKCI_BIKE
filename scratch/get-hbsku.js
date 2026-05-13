async function main() {
    const u = '2c8b04a9-3898-4925-99a5-98875224b436';
    const p = 'xraAz49GJu29';
    const auth = `Basic ${Buffer.from(u + ':' + p).toString('base64')}`;
    
    // Search for S89FAST28 to get its HB SKU
    const r = await fetch(`https://mpop-sit.hepsiburada.com/product/api/products?barcode=S89FAST28`, {
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
