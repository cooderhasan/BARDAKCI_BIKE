import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-guard";
import { checkTrendyolBatchRequest } from "@/app/admin/(protected)/integrations/trendyol/actions";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    if (!(await isAdminRequest())) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    const res = await checkTrendyolBatchRequest(params.id);
    return NextResponse.json(res);
}
