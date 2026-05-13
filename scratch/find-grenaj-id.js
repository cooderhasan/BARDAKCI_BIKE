async function main() {
    const u = '2c8b04a9-3898-4925-99a5-98875224b436';
    const p = 'xraAz49GJu29';
    const auth = `Basic ${Buffer.from(u + ':' + p).toString('base64')}`;
    
    console.log("Searching for 'Grenaj' and 'Aksam' leaf categories...");
    
    // Fetch with a large size to find hidden gems
    const r = await fetch(`https://mpop-sit.hepsiburada.com/product/api/categories/get-all-categories?size=10000`, {
        headers: {
            'Authorization': auth,
            'User-Agent': 'serinmotor_dev',
            'Accept': 'application/json'
        }
    });
    const d = await r.json();
    if (d.data) {
        const results = d.data.filter(c => 
            c.leaf === true && 
            (c.paths.join(" ").toLowerCase().includes("grenaj") || c.name.toLowerCase().includes("grenaj"))
        );
        
        if (results.length === 0) {
            console.log("No specific 'Grenaj' leaf category found in SIT.");
            // Try broader search
            const broader = d.data.filter(c => 
                c.leaf === true && 
                c.paths.join(" ").toLowerCase().includes("motosiklet") &&
                c.paths.join(" ").toLowerCase().includes("yedek parça")
            );
            console.log(`Found ${broader.length} Moto Spare Parts leaf categories:`);
            broader.slice(0, 20).forEach(c => {
                console.log(`ID: ${c.categoryId} | Path: ${c.paths.join(' > ')}`);
            });
        } else {
            console.log(`Found ${results.length} Grenaj categories:`);
            results.forEach(c => {
                console.log(`ID: ${c.categoryId} | Path: ${c.paths.join(' > ')}`);
            });
        }
    }
}

main();
