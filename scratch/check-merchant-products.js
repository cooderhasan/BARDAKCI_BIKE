async function main() {
    const u = '2c8b04a9-3898-4925-99a5-98875224b436';
    const p = 'xraAz49GJu29';
    const auth = `Basic ${Buffer.from(u + ':' + p).toString('base64')}`;
    
    // Search products for OUR merchant
    const r = await fetch(`https://mpop-sit.hepsiburada.com/product/api/products?merchant=2c8b04a9-3898-4925-99a5-98875224b436`, {
        headers: {
            'Authorization': auth,
            'User-Agent': 'serinmotor_dev',
            'Accept': 'application/json'
        }
    });
    
    const d = await r.json();
    console.log("Total found for our merchant:", d.length);
    if (d.length > 0) {
        console.log("Last product name:", d[0].attributes.UrunAdi.value);
        console.log("Last product status:", d[0].status);
    }
}

main();
