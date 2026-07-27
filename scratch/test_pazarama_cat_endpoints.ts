import { prisma } from "../src/lib/db";
import { PazaramaClient } from "../src/services/pazarama/api";

async function main() {
  const config = await (prisma as any).pazaramaConfig.findFirst();
  console.log("Config from DB:", config ? {
    merchantId: config.merchantId,
    apiKey: config.apiKey ? config.apiKey.substring(0, 5) + "..." : "missing",
    isTestMode: config.isTestMode,
    isActive: config.isActive
  } : "None");

  if (!config) return;

  const client = new PazaramaClient(config);
  const tokenRes = await (client as any).getToken();
  console.log("Token response:", tokenRes);

  if (!tokenRes.success) return;

  const baseUrl = config.isTestMode
    ? "https://stage-isortagimapi.pazarama.com"
    : "https://isortagimapi.pazarama.com";

  const endpoints = [
    { url: `${baseUrl}/category/getCategoryWithAttributes`, method: "GET" },
    { url: `${baseUrl}/category/getCategoryWithAttributes`, method: "POST", body: {} },
    { url: `${baseUrl}/category/get-categories`, method: "GET" },
    { url: `${baseUrl}/category/get-categories`, method: "POST", body: {} },
    { url: `${baseUrl}/category/getCategories`, method: "GET" },
    { url: `${baseUrl}/category/getCategories`, method: "POST", body: {} },
    { url: `${baseUrl}/category/get`, method: "GET" },
    { url: `${baseUrl}/category/get`, method: "POST", body: {} },
    { url: `${baseUrl}/brand/getBrands`, method: "GET" },
    { url: `${baseUrl}/brand/getBrands`, method: "POST", body: {} },
    { url: `${baseUrl}/brand/getBrandList`, method: "GET" },
    { url: `${baseUrl}/brand/getBrandList`, method: "POST", body: {} },
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        method: ep.method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenRes.accessToken}`,
        },
        ...(ep.body ? { body: JSON.stringify(ep.body) } : {}),
      });

      const status = res.status;
      const text = await res.text();
      console.log(`[${ep.method}] ${ep.url} => HTTP ${status}: ${text.substring(0, 200)}`);
    } catch (e: any) {
      console.log(`[${ep.method}] ${ep.url} => Error: ${e.message}`);
    }
  }
}

main().catch(console.error);
