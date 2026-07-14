async function checkStatus() {
    const username = "159117dc-31cb-4989-a2a2-4b11388a91a5";
    const password = "RDZrPzn5B3UH";
    const trackingId = "2924f95f-b4d1-4d77-91fa-2e180db509c7";
    
    const pair = `${username}:${password}`;
    const authHeader = `Basic ${Buffer.from(pair).toString("base64")}`;
    
    const url = `https://mpop-sit.hepsiburada.com/product/api/products/status/${trackingId}`;
    console.log("Fetching status:", url);
    
    try {
        const response = await fetch(url, {
            headers: {
                "Authorization": authHeader,
                "User-Agent": "motovitrin_dev",
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
