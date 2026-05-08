import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// TEMPORARY DEBUG ENDPOINT - DELETE AFTER DIAGNOSIS
// Usage: GET /api/debug/n11-attrs?catId=YOUR_CAT_ID
export async function GET(req: NextRequest) {
    try {
        const catId = req.nextUrl.searchParams.get("catId") || "1000506"; // test with a common category

        const config = await (prisma as any).n11Config.findFirst({ where: { isActive: true } });
        if (!config) return NextResponse.json({ error: "No N11 config found" });

        const url = `https://api.n11.com/cdn/category/${catId}/attribute`;
        const res = await fetch(url, {
            headers: {
                "appKey": config.apiKey,
                "appSecret": config.apiSecret,
                "Content-Type": "application/json",
            }
        });

        const raw = await res.json();

        // Return the raw response so we can see the exact structure
        return NextResponse.json({
            status: res.status,
            catId,
            topLevelKeys: Object.keys(raw),
            firstAttribute: raw.categoryAttributes?.[0] || null,
            firstAttributeValuesCount: raw.categoryAttributes?.[0]?.attributeValues?.length || 0,
            firstValue: raw.categoryAttributes?.[0]?.attributeValues?.[0] || null,
        }, { status: 200 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
