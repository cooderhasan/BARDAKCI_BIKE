import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PazaramaClient } from "@/services/pazarama/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const config = await (prisma as any).pazaramaConfig.findFirst({ where: { isActive: true } });
    if (!config) {
      return NextResponse.json({ error: "Aktif Pazarama konfigürasyonu bulunamadı." });
    }

    const client = new PazaramaClient(config);
    let token = "";
    try {
      token = await client.getAccessToken();
    } catch (e: any) {
      return NextResponse.json({ error: "Pazarama Token Alma Hatası", details: e.message });
    }

    const baseUrl = config.isTestMode
      ? "https://stage-isortagimapi.pazarama.com"
      : "https://isortagimapi.pazarama.com";

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    // Candidate Payloads for Pazarama Order API
    const testCases = [
      { name: "1. Empty Body", payload: {} },
      { name: "2. Simple dates (YYYY-MM-DD)", payload: { startDate: "2026-07-01", endDate: "2026-08-08", pageSize: 100, pageNumber: 1 } },
      { name: "3. ISO dates with T", payload: { startDate: "2026-07-01T00:00:00", endDate: "2026-08-08T23:59:59", pageSize: 100, pageNumber: 1 } },
      { name: "4. Dates with space", payload: { startDate: "2026-07-01 00:00:00", endDate: "2026-08-08 23:59:59", pageSize: 100, pageNumber: 1 } },
      { name: "5. Specific Order Number 525237058 (int)", payload: { orderNumber: 525237058 } },
      { name: "6. Specific Order Number 525237058 (string)", payload: { orderNumber: "525237058" } },
      { name: "7. OrderStatus 0 (All)", payload: { orderStatus: 0, pageSize: 100, pageNumber: 1 } },
      { name: "8. OrderStatus 12 (Processing/Preparing)", payload: { orderStatus: 12, pageSize: 100, pageNumber: 1 } },
      { name: "9. OrderStatus 3 (Created)", payload: { orderStatus: 3, pageSize: 100, pageNumber: 1 } },
    ];

    const results: any[] = [];

    // Also test different candidate order endpoints
    const orderEndpoints = [
      `${baseUrl}/order/getOrdersForApi`,
      `${baseUrl}/order/get-orders`,
      `${baseUrl}/order/orders`,
      `${baseUrl}/order/getOrders`,
    ];

    for (const endpoint of orderEndpoints) {
      for (const tc of testCases) {
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify(tc.payload),
            cache: "no-store",
          });

          const status = res.status;
          const text = await res.text();
          let parsed: any = null;
          try { parsed = JSON.parse(text); } catch {}

          if (status !== 404) {
            results.push({
              endpoint,
              testName: tc.name,
              status,
              rawText: text.substring(0, 1000),
              parsed,
            });
          }
        } catch (err: any) {
          results.push({
            endpoint,
            testName: tc.name,
            error: err.message,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      configInfo: {
        merchantId: config.merchantId,
        isTestMode: config.isTestMode,
        isActive: config.isActive,
      },
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
