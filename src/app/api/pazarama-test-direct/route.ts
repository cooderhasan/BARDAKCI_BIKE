import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PazaramaClient } from "@/services/pazarama/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await (prisma as any).pazaramaConfig.findFirst();
    if (!config) {
      return NextResponse.json({ error: "DB'de Pazarama konfigürasyonu bulunamadı" });
    }

    let token = "";
    try {
      token = await client.getAccessToken();
    } catch (tokenErr: any) {
      return NextResponse.json({ error: "Token error: " + tokenErr.message });
    }
    const baseUrl = config.isTestMode
      ? "https://stage-isortagimapi.pazarama.com"
      : "https://isortagimapi.pazarama.com";

    const endpoints = [
      { name: "GET /category/get-categories", url: `${baseUrl}/category/get-categories`, method: "GET" },
      { name: "POST /category/get-categories", url: `${baseUrl}/category/get-categories`, method: "POST", body: {} },
      { name: "GET /api/v1/category/get-categories", url: `${baseUrl}/api/v1/category/get-categories`, method: "GET" },
      { name: "POST /api/v1/category/get-categories", url: `${baseUrl}/api/v1/category/get-categories`, method: "POST", body: {} },
      { name: "GET /category/getCategories", url: `${baseUrl}/category/getCategories`, method: "GET" },
      { name: "POST /category/getCategories", url: `${baseUrl}/category/getCategories`, method: "POST", body: {} },
      { name: "GET /category/getCategoryWithAttributes", url: `${baseUrl}/category/getCategoryWithAttributes`, method: "GET" },
      { name: "GET /api/v1/category/getCategoryWithAttributes", url: `${baseUrl}/api/v1/category/getCategoryWithAttributes`, method: "GET" },
    ];

    const results: any[] = [];
    if (token) {
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
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      config: {
        id: config.id,
        merchantId: config.merchantId,
        isActive: config.isActive,
        isTestMode: config.isTestMode,
        hasApiKey: !!config.apiKey,
        hasApiSecret: !!config.apiSecret,
      },
      tokenSuccess: tokenRes.success,
      results,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
