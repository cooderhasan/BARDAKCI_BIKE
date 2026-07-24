import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PazaramaClient } from "@/services/pazarama/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const debugLog: any = {};
  try {
    debugLog.step = "Finding config";
    const config = await (prisma as any).pazaramaConfig.findFirst();
    debugLog.configFound = !!config;
    if (!config) {
      return NextResponse.json({ error: "DB'de Pazarama konfigürasyonu bulunamadı", debugLog });
    }

    debugLog.configSummary = {
      id: config.id,
      merchantId: config.merchantId,
      isActive: config.isActive,
      isTestMode: config.isTestMode,
      hasApiKey: !!config.apiKey,
      hasApiSecret: !!config.apiSecret,
    };

    debugLog.step = "Initializing client";
    const client = new PazaramaClient(config);

    debugLog.step = "Getting access token";
    let token = "";
    try {
      token = await client.getAccessToken();
      debugLog.tokenAcquired = true;
      debugLog.tokenLength = token.length;
    } catch (tokenErr: any) {
      debugLog.tokenError = tokenErr.message;
      return NextResponse.json({ error: "Token hatası", tokenErr: tokenErr.message, debugLog });
    }

    const baseUrl = config.isTestMode
      ? "https://stage-isortagimapi.pazarama.com"
      : "https://isortagimapi.pazarama.com";

    const endpoints = [
      // Categories
      { name: "GET /category/get-categories", url: `${baseUrl}/category/get-categories`, method: "GET" },
      { name: "POST /category/get-categories", url: `${baseUrl}/category/get-categories`, method: "POST", body: {} },
      { name: "GET /category/getCategories", url: `${baseUrl}/category/getCategories`, method: "GET" },
      // Product Create Candidates
      { name: "POST /product/create-product", url: `${baseUrl}/product/create-product`, method: "POST", body: { items: [] } },
      { name: "POST /product/createProduct", url: `${baseUrl}/product/createProduct`, method: "POST", body: { items: [] } },
      { name: "POST /product/create", url: `${baseUrl}/product/create`, method: "POST", body: { items: [] } },
      { name: "POST /api/v1/product/createProduct", url: `${baseUrl}/api/v1/product/createProduct`, method: "POST", body: { items: [] } },
      // Stock & Price Update Candidates
      { name: "POST /product/update-price-and-stock", url: `${baseUrl}/product/update-price-and-stock`, method: "POST", body: { items: [] } },
      { name: "POST /product/updatePriceAndStock", url: `${baseUrl}/product/updatePriceAndStock`, method: "POST", body: { items: [] } },
      { name: "POST /product/update-stock-and-price", url: `${baseUrl}/product/update-stock-and-price`, method: "POST", body: { items: [] } },
      { name: "POST /api/v1/product/updatePriceAndStock", url: `${baseUrl}/api/v1/product/updatePriceAndStock`, method: "POST", body: { items: [] } },
    ];

    const results: any[] = [];
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep.url, {
          method: ep.method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          ...(ep.body ? { body: JSON.stringify(ep.body) } : {}),
          cache: "no-store",
        });

        const status = res.status;
        const text = await res.text();
        let parsed = null;
        try { parsed = JSON.parse(text); } catch {}

        results.push({
          endpointName: ep.name,
          url: ep.url,
          method: ep.method,
          status,
          rawPreview: text.slice(0, 300),
          parsed,
        });
      } catch (e: any) {
        results.push({ endpointName: ep.name, url: ep.url, error: e.message });
      }
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      debugLog,
      results,
    });
  } catch (err: any) {
    return NextResponse.json({
      error: err.message,
      stack: err.stack,
      debugLog,
    });
  }
}
