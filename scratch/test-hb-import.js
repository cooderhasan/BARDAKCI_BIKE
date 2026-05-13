async function main() {
    const u = '2c8b04a9-3898-4925-99a5-98875224b436';
    const p = 'xraAz49GJu29';
    const auth = `Basic ${Buffer.from(u + ':' + p).toString('base64')}`;
    
    const payload = [{
        categoryId: 80405008,
        merchant: "2c8b04a9-3898-4925-99a5-98875224b436",
        attributes: {
            merchantSku: "test-enum-1",
            VaryantGroupID: "test-enum-1",
            Barcode: "182237223456",
            UrunAdi: "Cg Motor Alt Sakal Nikel Test Enum",
            UrunAciklamasi: "Test",
            Marka: "Diğer",
            GarantiSuresi: 24,
            kg: "1",
            tax_vat_rate: "20",
            price: "100",
            stock: "10",
            // Here we test the ID for Mensei
            "00000MP": "Türkiye",
            "renk_variant_property": "Siyah",
            "secenek_variant_property": "Standart"
        }
    }];
    
    const r = await fetch('https://mpop-sit.hepsiburada.com/product/api/products/import', {
        method: 'POST',
        headers: {
            'Authorization': auth,
            'User-Agent': 'serinmotor_dev',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    
    const d = await r.json();
    console.log(JSON.stringify(d, null, 2));
    if (d.data && d.data.trackingId) {
        console.log("Checking status in 3s...");
        setTimeout(async () => {
            const r2 = await fetch(`https://mpop-sit.hepsiburada.com/product/api/products/status/${d.data.trackingId}`, {
                headers: {
                    'Authorization': auth,
                    'User-Agent': 'serinmotor_dev',
                    'Accept': 'application/json'
                }
            });
            console.log(await r2.text());
        }, 3000);
    }
}

main();
