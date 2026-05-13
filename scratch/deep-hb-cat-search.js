async function main() {
    const u = '2c8b04a9-3898-4925-99a5-98875224b436';
    const p = 'xraAz49GJu29';
    const auth = `Basic ${Buffer.from(u + ':' + p).toString('base64')}`;
    
    // Search for any category related to Motosiklet or Grenaj
    const queries = ['Motosiklet', 'Grenaj', 'Sakal', 'Kilit'];
    let allFound = [];
    
    for (const q of queries) {
        console.log(`Searching for: ${q}...`);
        const r = await fetch(`https://mpop-sit.hepsiburada.com/product/api/categories/get-all-categories?name=${encodeURIComponent(q)}`, {
            headers: {
                'Authorization': auth,
                'User-Agent': 'serinmotor_dev',
                'Accept': 'application/json'
            }
        });
        const d = await r.json();
        if (d.data) {
            console.log(`Found ${d.data.length} results for ${q}`);
            allFound.push(...d.data);
        }
    }
    
    // Filter leaf categories
    const leafCats = allFound.filter(c => c.leaf === true);
    console.log(`Total Leaf Categories found: ${leafCats.length}`);
    
    leafCats.slice(0, 10).forEach(c => {
        console.log(`[LEAF] ID: ${c.categoryId} | Name: ${c.paths.join(' > ')}`);
    });
}

main();
