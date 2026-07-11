import "dotenv/config";

// Read API credentials from database
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testN11() {
    const config = await prisma.n11Config.findFirst();
    
    if (!config) {
        console.log("❌ N11 config bulunamadı! Admin panelden kaydettin mi?");
        console.log("Manuel test yapılıyor...");
    }

    const apiKey = config?.apiKey || "05d350f6-a5ca-403b-b11b-4d53a8fc615e";
    const apiSecret = config?.apiSecret;
    
    if (!apiSecret) {
        console.log("❌ API Secret bulunamadı!");
        return;
    }

    console.log("🔑 API Key:", apiKey);
    console.log("🔑 Shipment Template:", config?.shipmentTemplate);
    console.log("---");

    const headers: Record<string, string> = {
        "appKey": apiKey,
        "appSecret": apiSecret,
        "Content-Type": "application/json",
        "Accept": "application/json"
    };

    // Test 1: Minimal payload - integrator yok
    const minimalPayload = {
        payload: {
            skus: [
                {
                    title: "Test Ürün",
                    description: "Test açıklama",
                    categoryId: 1190220,
                    currencyType: "TL",
                    productMainId: "TEST-001",
                    preparingDay: 3,
                    shipmentTemplate: config?.shipmentTemplate || "Motovitrin Mağaza1",
                    stockCode: "TEST-001",
                    salePrice: 100,
                    listPrice: 100,
                    vatRate: 20,
                    quantity: 1,
                    images: [
                        { url: "https://www.bardakcibike.com.tr/uploads/1783779751696-jrv54a.JPG", order: 1 }
                    ],
                    attributes: [
                        { id: 1, valueId: 17138957 }
                    ]
                }
            ]
        }
    };

    console.log("\n📤 Test 1: Minimal payload (integrator YOK)");
    
    try {
        const res1 = await fetch("https://api.n11.com/ms/product/tasks/product-create", {
            method: "POST",
            headers,
            body: JSON.stringify(minimalPayload)
        });
        const text1 = await res1.text();
        console.log("Status:", res1.status);
        console.log("Response:", text1);
    } catch (e: any) {
        console.log("Error:", e.message);
    }

    // Test 2: Integrator ile
    const withIntegrator = {
        payload: {
            integrator: "SRN_Entegrasyon",
            skus: minimalPayload.payload.skus
        }
    };

    console.log("\n📤 Test 2: integrator: SRN_Entegrasyon ile");
    
    try {
        const res2 = await fetch("https://api.n11.com/ms/product/tasks/product-create", {
            method: "POST",
            headers,
            body: JSON.stringify(withIntegrator)
        });
        const text2 = await res2.text();
        console.log("Status:", res2.status);
        console.log("Response:", text2);
    } catch (e: any) {
        console.log("Error:", e.message);
    }

    // Test 3: currencyType "TRY" ile
    const withTRY = {
        payload: {
            skus: [
                {
                    ...minimalPayload.payload.skus[0],
                    currencyType: "TRY"
                }
            ]
        }
    };

    console.log("\n📤 Test 3: currencyType: TRY ile");
    
    try {
        const res3 = await fetch("https://api.n11.com/ms/product/tasks/product-create", {
            method: "POST",
            headers,
            body: JSON.stringify(withTRY)
        });
        const text3 = await res3.text();
        console.log("Status:", res3.status);
        console.log("Response:", text3);
    } catch (e: any) {
        console.log("Error:", e.message);
    }

    // Test 4: Boş attributes ile
    const noAttrs = {
        payload: {
            skus: [
                {
                    ...minimalPayload.payload.skus[0],
                    attributes: []
                }
            ]
        }
    };

    console.log("\n📤 Test 4: Attributes boş");
    
    try {
        const res4 = await fetch("https://api.n11.com/ms/product/tasks/product-create", {
            method: "POST",
            headers,
            body: JSON.stringify(noAttrs)
        });
        const text4 = await res4.text();
        console.log("Status:", res4.status);
        console.log("Response:", text4);
    } catch (e: any) {
        console.log("Error:", e.message);
    }

    // Test 5: listPrice > salePrice
    const diffPrices = {
        payload: {
            skus: [
                {
                    ...minimalPayload.payload.skus[0],
                    salePrice: 90,
                    listPrice: 100
                }
            ]
        }
    };

    console.log("\n📤 Test 5: listPrice > salePrice (90 vs 100)");
    
    try {
        const res5 = await fetch("https://api.n11.com/ms/product/tasks/product-create", {
            method: "POST",
            headers,
            body: JSON.stringify(diffPrices)
        });
        const text5 = await res5.text();
        console.log("Status:", res5.status);
        console.log("Response:", text5);
    } catch (e: any) {
        console.log("Error:", e.message);
    }

    await prisma.$disconnect();
}

testN11().catch(console.error);
