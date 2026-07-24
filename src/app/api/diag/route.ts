import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
    try {
        let pazaramaDiag: any = null;
        try {
            const config = await (prisma as any).pazaramaConfig.findFirst();
            if (config) {
                const { PazaramaClient } = await import("@/services/pazarama/api");
                const client = new PazaramaClient(config);
                const tokenRes = await (client as any).getToken();
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
                ];

                const epResults: any[] = [];
                if (tokenRes.success) {
                    for (const ep of endpoints) {
                        try {
                            const res = await fetch(ep.url, {
                                method: ep.method,
                                headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${tokenRes.accessToken}`,
                                },
                                ...(ep.body ? { body: JSON.stringify(ep.body) } : {}),
                                cache: "no-store",
                            });

                            const text = await res.text();
                            let parsed = null;
                            try { parsed = JSON.parse(text); } catch {}

                            epResults.push({
                                url: ep.url,
                                method: ep.method,
                                status: res.status,
                                response: parsed || text.slice(0, 200),
                            });
                        } catch (e: any) {
                            epResults.push({ url: ep.url, method: ep.method, error: e.message });
                        }
                    }
                }

                pazaramaDiag = {
                    configFound: true,
                    isActive: config.isActive,
                    isTestMode: config.isTestMode,
                    tokenRes,
                    epResults,
                };
            } else {
                pazaramaDiag = { configFound: false };
            }
        } catch (e: any) {
            pazaramaDiag = { error: e.message };
        }

        return NextResponse.json({
            pazaramaDiag,
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message });
    }
}
