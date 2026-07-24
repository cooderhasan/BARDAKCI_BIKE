import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PazaramaClient } from "@/services/pazarama/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await (prisma as any).pazaramaConfig.findFirst();
    if (!config) {
      return NextResponse.json({ error: "No pazaramaConfig in DB" });
    }

    const client = new PazaramaClient(config);
    // Access private method or test endpoints directly
    const tokenRes = await (client as any).getToken();
    if (!tokenRes.success) {
      return NextResponse.json({ error: "Token failed", tokenRes });
    }

    const token = tokenRes.accessToken;
    const baseUrl = config.isTestMode
      ? "https://stage-isortagimapi.pazarama.com"
      : "https://isortagimapi.pazarama.com";

    const endpoints = [
      { url: `${baseUrl}/category/get-categories`, method: "GET" },
      { url: `${baseUrl}/category/get-categories`, method: "POST", body: {} },
      { url: `${baseUrl}/api/v1/category/get-categories`, method: "GET" },
      { url: `${baseUrl}/api/v1/category/get-categories`, method: "POST", body: {} },
      { url: `${baseUrl}/category/getCategories`, method: "GET" },
      { url: `${baseUrl}/category/getCategories`, method: "POST", body: {} },
      { url: `${baseUrl}/category/getCategoryWithAttributes`, method: "GET" },
      { url: `${baseUrl}/api/v1/category/getCategoryWithAttributes`, method: "GET" },
      { url: `${baseUrl}/category/categories`, method: "GET" },
      { url: `${baseUrl}/category/all`, method: "GET" },
      { url: `${baseUrl}/category/get-all`, method: "GET" },
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
        try {
          parsed = JSON.parse(text);
        } catch {}

        results.push({
          url: ep.url,
          method: ep.method,
          status,
          response: parsed || text.slice(0, 300),
        });
      } catch (e: any) {
        results.push({
          url: ep.url,
          method: ep.method,
          error: e.message,
        });
      }
    }

    return NextResponse.json({
      configSummary: {
        isTestMode: config.isTestMode,
        isActive: config.isActive,
        merchantId: config.merchantId,
        hasApiKey: !!config.apiKey,
      },
      tokenResSuccess: tokenRes.success,
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Error during debug" }, { status: 500 });
  }
}
