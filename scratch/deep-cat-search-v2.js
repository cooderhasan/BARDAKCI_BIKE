async function main() {
    const u = '2c8b04a9-3898-4925-99a5-98875224b436';
    const p = 'xraAz49GJu29';
    const auth = `Basic ${Buffer.from(u + ':' + p).toString('base64')}`;
    
    // Fetch 5000 categories to be sure
    const r = await fetch(`https://mpop-sit.hepsiburada.com/product/api/categories/get-all-categories?size=5000`, {
        headers: {
            'Authorization': auth,
            'User-Agent': 'serinmotor_dev',
            'Accept': 'application/json'
        }
    });
    const d = await r.json();
    if (d.data) {
        const results = d.data.filter(c => 
            c.paths.join(" ").toLowerCase().includes("motosiklet") &&
            (c.paths.join(" ").toLowerCase().includes("grenaj") || c.paths.join(" ").toLowerCase().includes("sakal"))
        );
        console.log(`Found ${results.length} results.`);
        results.forEach(c => {
            console.log(`[${c.leaf ? 'LEAF' : 'PARENT'}] ID: ${c.categoryId} | Path: ${c.paths.join(' > ')}`);
        });
    }
}

main();
