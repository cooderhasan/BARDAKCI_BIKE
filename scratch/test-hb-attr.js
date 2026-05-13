async function testHB() {
    const username = "2c8b04a9-3898-4925-99a5-98875224b436";
    const password = "xraAz49GJu29";
    const categoryId = "60005694";
    
    const pair = `${username}:${password}`;
    const authHeader = `Basic ${Buffer.from(pair).toString("base64")}`;
    
    const url = `https://mpop-sit.hepsiburada.com/product/api/categories/${categoryId}/attributes`;
    console.log("Fetching:", url);
    
    try {
        const response = await fetch(url, {
            headers: {
                "Authorization": authHeader,
                "User-Agent": "serinmotor_dev",
                "Accept": "application/json"
            }
        });
        
        console.log("Status:", response.status, response.statusText);
        const text = await response.text();
        console.log("Body:", text.substring(0, 500));
    } catch (e) {
        console.error("Error:", e);
    }
}

testHB();
