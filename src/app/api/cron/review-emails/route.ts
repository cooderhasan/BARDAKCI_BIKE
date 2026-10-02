import { NextRequest, NextResponse } from "next/server";
import { processDueReviewEmails } from "@/app/admin/(protected)/orders/actions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        // Optional CRON_SECRET authorization check
        const cronSecret = process.env.CRON_SECRET;
        const authHeader = req.headers.get("authorization");
        const urlKey = req.nextUrl.searchParams.get("key");

        if (cronSecret) {
            const isAuthorized =
                authHeader === `Bearer ${cronSecret}` ||
                urlKey === cronSecret;

            if (!isAuthorized) {
                return NextResponse.json(
                    { success: false, error: "Unauthorized" },
                    { status: 401 }
                );
            }
        }

        const result = await processDueReviewEmails();
        return NextResponse.json(result);
    } catch (error) {
        console.error("Cron review-emails error:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Internal error" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    return GET(req);
}
