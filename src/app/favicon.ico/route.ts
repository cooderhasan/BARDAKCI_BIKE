import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const generalSettings = await prisma.siteSettings.findUnique({
      where: { key: "general" },
    });
    const general = (generalSettings?.value as any) || {};

    if (general.faviconUrl) {
      // Absolute URL ise redirect, relative ise internal redirect
      if (general.faviconUrl.startsWith("http")) {
        return NextResponse.redirect(general.faviconUrl);
      } else {
        const siteUrl =
          process.env.NEXT_PUBLIC_APP_URL || "https://www.bardakcibike.com.tr";
        return NextResponse.redirect(`${siteUrl}${general.faviconUrl}`);
      }
    }
  } catch {
    // DB unavailable
  }

  return new NextResponse(null, { status: 404 });
}
