async function checkStatus() {
    const username = "2c8b04a9-3898-4925-99a5-98875224b436";
    const password = "xraAz49GJu29";
    const trackingId = "05b6af44-0b88-4f31-ac03-babfb760a999";
    
    const pair = `${username}:${password}`;
    const authHeader = `Basic ${Buffer.from(pair).toString("base64")}`;
    
    const url = `https://mpop-sit.hepsiburada.com/product/api/products/status/${trackingId}`;
    console.log("Fetching status:", url);
    
    try {
        const response = await fetch(url, {
            headers: {
                "Authorization": authHeader,
                "User-Agent": "serinmotor_dev",
                "Accept": "application/json"
            }
        });
        
        console.log("Status Code:", response.status);
        const data = await response.json();
        console.log("Response:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

checkStatus();
