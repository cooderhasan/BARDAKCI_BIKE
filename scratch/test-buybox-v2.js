async function main() {
    const u = '2c8b04a9-3898-4925-99a5-98875224b436';
    const p = 'xraAz49GJu29';
    const auth = `Basic ${Buffer.from(u + ':' + p).toString('base64')}`;
    
    const payload = [{
        categoryId: 80405008,
        merchant: "2c8b04a9-3898-4925-99a5-98875224b436",
        attributes: {
            merchantSku: "test-buybox-v2",
            VaryantGroupID: "test-buybox-v2",
            Barcode: "9998887776662",
            UrunAdi: "Test Buybox Product V2",
            UrunAciklamasi: "Test",
            Marka: "Diğer",
            GarantiSuresi: 24,
            kg: "1",
            tax_vat_rate: "20",
            price: "150",
            stock: "5",
            "hbSku": "HBCV0000E1R2IY"
        }
    }];
    
    const jsonContent = JSON.stringify(payload);
    const formData = new FormData();
    formData.append("file", new Blob([jsonContent], { type: "application/json" }), "integrator.json");
    
    const r = await fetch('https://mpop-sit.hepsiburada.com/product/api/products/import', {
        method: 'POST',
        headers: {
            'Authorization': auth,
            'User-Agent': 'serinmotor_dev',
            'Accept': 'application/json'
        },
        body: formData
    });
    
    const d = await r.json();
    console.log(JSON.stringify(d, null, 2));
}

main();
