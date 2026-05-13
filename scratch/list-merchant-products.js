async function main() {
    const u = '2c8b04a9-3898-4925-99a5-98875224b436';
    const p = 'xraAz49GJu29';
    const auth = `Basic ${Buffer.from(u + ':' + p).toString('base64')}`;
    
    const r = await fetch(`https://mpop-sit.hepsiburada.com/product/api/products?merchant=2c8b04a9-3898-4925-99a5-98875224b436`, {
        headers: {
            'Authorization': auth,
            'User-Agent': 'serinmotor_dev',
            'Accept': 'application/json'
        }
    });
    
    const d = await r.json();
    console.log(`Found ${d.length} products:`);
    d.forEach(p => {
        const name = p.attributes && p.attributes.UrunAdi ? p.attributes.UrunAdi.value : 'No Name';
        console.log(`- ${name} | Status: ${p.status} | Barcode: ${p.merchantSku}`);
    });
}

main();
