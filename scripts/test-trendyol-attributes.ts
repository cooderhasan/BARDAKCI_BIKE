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
        "Content-Type": "application/json",
        "storeFrontCode": "TR"
    };

    const categoryId = 411; // Testing with known generic category ID for API test

    const url = `${gatewayUrl}/integration/product/categories/${categoryId}/attributes`;
    console.log("Fetching attributes from:", url);
    const attrResponse = await fetch(url, { headers });
    const attrData = await attrResponse.json();
    console.log(JSON.stringify(attrData, null, 2).substring(0, 1000));
}

main().catch(console.error).finally(() => prisma.$disconnect());
