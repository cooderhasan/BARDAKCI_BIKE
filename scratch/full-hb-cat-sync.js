async function main() {
    const u = '2c8b04a9-3898-4925-99a5-98875224b436';
    const p = 'xraAz49GJu29';
    const auth = `Basic ${Buffer.from(u + ':' + p).toString('base64')}`;
    
    let allLeafs = [];
    let page = 0;
    const size = 1000;
    let hasMore = true;
    
    const keywords = ['motosiklet', 'bisiklet', 'yedek parça', 'aksesuar'];
    
    while (hasMore && page < 20) { // Limit to 20 pages (20k cats)
        console.log(`Fetching page ${page}...`);
        const r = await fetch(`https://mpop-sit.hepsiburada.com/product/api/categories/get-all-categories?page=${page}&size=${size}`, {
            headers: {
                'Authorization': auth,
                'User-Agent': 'serinmotor_dev',
                'Accept': 'application/json'
            }
        });
        const d = await r.json();
        if (d.data && d.data.length > 0) {
            const filtered = d.data.filter(c => 
                c.leaf === true && 
                keywords.some(k => c.paths.join(" ").toLowerCase().includes(k))
            );
            allLeafs.push(...filtered);
            console.log(`Page ${page}: Found ${filtered.length} matching leaf categories.`);
            page++;
            if (d.data.length < size) hasMore = false;
        } else {
            hasMore = false;
        }
    }
    
    console.log(`\nScan Complete! Total Matching Leaf Categories: ${allLeafs.length}`);
    allLeafs.slice(0, 50).forEach(c => {
        console.log(`ID: ${c.categoryId} | Path: ${c.paths.join(' > ')}`);
    });
}

main();
