import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const config = await prisma.trendyolConfig.findFirst({ where: { isActive: true } });
    if (!config) {
        console.log("No config");
        return;
    }

    const gatewayUrl = "https://apigw.trendyol.com";
    const pair = `${config.apiKey}:${config.apiSecret}`;
    const headers = {
        "Authorization": `Basic ${Buffer.from(pair).toString("base64")}`,
        "User-Agent": `${config.supplierId} - SelfIntegration`,
        "Content-Type": "application/json"
    };

    const providerUrls = [
        `${gatewayUrl}/integration/cargo/sellers/${config.supplierId}/providers`,
        `${gatewayUrl}/integration/product/shipping-providers`,
        `${gatewayUrl}/integration/cargoproviders`
    ];

    console.log("--- Testing Providers ---");
    for (const url of providerUrls) {
        try {
            const res = await fetch(url, { headers });
            console.log(`[${res.status}] ${url}`);
            if (res.ok) {
                const data = await res.json();
                console.log(`SUCCESS! Data length: ${data.length}`);
                break;
            }
        } catch (e) {
            console.log(`ERROR ${url}:`, e);
        }
    }

    const addressUrls = [
        `${gatewayUrl}/integration/sellers/${config.supplierId}/addresses`,
        `${gatewayUrl}/integration/cargo/sellers/${config.supplierId}/addresses`
    ];

    console.log("\n--- Testing Addresses ---");
    for (const url of addressUrls) {
        try {
            const res = await fetch(url, { headers });
            console.log(`[${res.status}] ${url}`);
            if (res.ok) {
                const data = await res.json();
                console.log(`SUCCESS! Address count:`, data);
                break;
            }
        } catch (e) {
            console.log(`ERROR ${url}:`, e);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
