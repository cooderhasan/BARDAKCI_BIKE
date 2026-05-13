async function main() {
    const u = '2c8b04a9-3898-4925-99a5-98875224b436';
    const p = 'xraAz49GJu29';
    const auth = `Basic ${Buffer.from(u + ':' + p).toString('base64')}`;
    
    // Get ALL leaf categories
    const r = await fetch(`https://mpop-sit.hepsiburada.com/product/api/categories/get-all-categories?leaf=true`, {
        headers: {
            'Authorization': auth,
            'User-Agent': 'serinmotor_dev',
            'Accept': 'application/json'
        }
    });
    const d = await r.json();
    if (d.data) {
        const motoCats = d.data.filter(c => 
            c.paths.some(p => p.toLowerCase().includes("motosiklet"))
        );
        console.log(`Found ${motoCats.length} Motosiklet related leaf categories.`);
        motoCats.forEach(c => {
            console.log(`[LEAF] ID: ${c.categoryId} | Path: ${c.paths.join(' > ')}`);
        });
    }
}

main();
