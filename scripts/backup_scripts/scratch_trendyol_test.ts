const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const config = await prisma.trendyolConfig.findFirst();
    if(!config) { console.log("No config"); return; }
    
    const product = await prisma.product.findFirst({
        where: { variants: { some: { barcode: '4606953779367' } } },
        include: { categories: true, brand: true, variants: true }
    });

    if(!product) { console.log("No product"); return; }

    const mappedCategory = product.categories.find((c: any) => c.trendyolCategoryId !== null);
    const brandId = product.brand?.trendyolBrandId;

    const defaultAttributes = [
        { attributeId: 1192, attributeValueId: 10617300 },  // Menşei: CN
        { attributeId: 338, attributeValueId: 6821 },       // Beden: Tek Ebat
        { attributeId: 1201, attributeValueId: 10621829 },  // Tamir Edilebilirlik: Tamir Edilmez
        { attributeId: 1209, attributeValueId: 10621791 },  // ECE Uygunluk: Görselinde bulunmuyor
        { attributeId: 1216, customAttributeValue: "Bardakcı Bike" }, // Birincil İthalatçı Adı
        { attributeId: 1116, customAttributeValue: "Ustanıza danışınız" }, // Kullanım Talimatı
    ];

    const items = [];
    const baseItem = {
        title: product.name,
        productMainId: product.sku || product.id,
        brandId: Number(brandId),
        categoryId: Number(mappedCategory.trendyolCategoryId),
        description: product.description || product.name,
        currencyType: "TRY",
        vatRate: product.vatRate,
        cargoCompanyId: Number(config.cargoCompanyId),
        shipmentAddressId: Number(config.shipmentAddressId),
        returningAddressId: Number(config.returningAddressId),
        deliveryOption: {
            deliveryDuration: 3,
            fastDeliveryType: "SAME_DAY_SHIPPING"
        },
        images: product.images.map((url: string) => ({ url: url.startsWith("http") ? url : `https://www.bardakcibike.com.tr${url}` })),
        attributes: defaultAttributes
    };

    const variant = product.variants.find((v: any) => v.barcode === '4606953779367');
    
    items.push({
        ...baseItem,
        barcode: variant.barcode,
        stockCode: variant.sku || variant.barcode,
        quantity: Math.max(0, variant.stock - (product.criticalStock || 0)),
        listPrice: Number(product.listPrice) + Number(variant.priceAdjustment || 0),
        salePrice: Number(product.listPrice) + Number(variant.priceAdjustment || 0),
        dimensionalWeight: 1,
    });

    console.log("PAYLOAD:", JSON.stringify(items, null, 2));

    const gatewayUrl = "https://apigw.trendyol.com";
    const pair = `${config.apiKey}:${config.apiSecret}`;
    const headers = {
        "Authorization": `Basic ${Buffer.from(pair).toString("base64")}`,
        "User-Agent": `${config.supplierId} - SelfIntegration`,
        "Content-Type": "application/json"
    };

    const url = `${gatewayUrl}/integration/product/sellers/${config.supplierId}/products`;
    const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ items })
    });

    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));

    if (data.batchRequestId) {
        console.log("WAITING 5 SECONDS...");
        await new Promise(r => setTimeout(r, 5000));
        
        console.log("--- BATCH STATUS (APIGW) ---");
        const batchUrl = `https://apigw.trendyol.com/integration/product/sellers/${config.supplierId}/products/batch-requests/${data.batchRequestId}`;
        const bRes = await fetch(batchUrl, { headers });
        console.log("APIGW Status:", bRes.status);
        if(bRes.ok) console.log(await bRes.text());
        else console.log(await bRes.text());
    }
}
main().finally(() => prisma.$disconnect());
