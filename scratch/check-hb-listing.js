async function main() {
    const u = '2c8b04a9-3898-4925-99a5-98875224b436';
    const p = 'xraAz49GJu29';
    const auth = `Basic ${Buffer.from(u + ':' + p).toString('base64')}`;
    
    // Check listings for OUR merchant
    const r = await fetch(`https://listing-external-sit.hepsiburada.com/listings/merchantid/2c8b04a9-3898-4925-99a5-98875224b436/inventory-uploads`, {
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
