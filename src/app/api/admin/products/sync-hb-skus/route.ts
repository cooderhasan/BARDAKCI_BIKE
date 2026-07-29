import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import * as path from "path";
import { prisma } from "@/lib/db";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  try {
    console.log("=== STARTING HEPSIBURADA SKU SYNC ON LIVE SERVER ===");
    let buffer: Buffer | null = null;
    const candidatePaths = [
      path.join(process.cwd(), "public", "tum_urunler.xlsx"),
      path.join(process.cwd(), "tum_urunler.xlsx"),
      path.join(process.cwd(), ".next", "standalone", "public", "tum_urunler.xlsx"),
      path.join(process.cwd(), ".next", "standalone", "tum_urunler.xlsx"),
    ];

    for (const p of candidatePaths) {
      try {
        if (require("fs").existsSync(p)) {
          buffer = require("fs").readFileSync(p);
          console.log("[SYNC-HB-SKU] Found Excel file at:", p);
          break;
        }
      } catch {}
    }

    if (!buffer) {
      const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.bardakcibike.com.tr";
      const fetchUrl = `${siteUrl}/tum_urunler.xlsx`;
      console.log("[SYNC-HB-SKU] Attempting HTTP fetch fallback:", fetchUrl);
      const res = await fetch(fetchUrl);
      if (res.ok) {
        const ab = await res.arrayBuffer();
        buffer = Buffer.from(ab);
      }
    }

    if (!buffer) {
      return NextResponse.json(
        { success: false, error: "tum_urunler.xlsx dosyası bulunamadı." },
        { status: 404 }
      );
    }

    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    console.log(`Total rows in Excel: ${rows.length}`);

    let linkedCount = 0;
    let skippedCount = 0;

    for (const r of rows) {
      const hbSku = String(r["HB Sku"] || "").trim();
      const urunKodu = String(r["Urun-Kodu"] || "").trim();
      const barcode = String(r["Barcode"] || "").trim();
      const merchantSku = urunKodu || barcode;

      if (!hbSku || !merchantSku) {
        skippedCount++;
        continue;
      }

      const ORConditions: any[] = [
        { sku: merchantSku },
        { barcode: merchantSku },
      ];
      if (urunKodu) ORConditions.push({ sku: urunKodu }, { barcode: urunKodu });
      if (barcode) ORConditions.push({ sku: barcode }, { barcode: barcode });

      const product = await prisma.product.findFirst({
        where: {
          OR: ORConditions,
        },
      });

      if (product) {
        await prisma.hepsiburadaProduct.upsert({
          where: { productId: product.id },
          create: {
            productId: product.id,
            hbSku: hbSku,
            merchantSku: merchantSku,
            isSynced: true,
          },
          update: {
            hbSku: hbSku,
            merchantSku: merchantSku,
            isSynced: true,
          },
        });
        linkedCount++;
      } else {
        skippedCount++;
      }
    }

    const totalHbMappedInDb = await prisma.hepsiburadaProduct.count();

    return NextResponse.json({
      success: true,
      message: "Hepsiburada SKU senkronizasyonu tamamlandı.",
      linkedInThisRun: linkedCount,
      skippedRows: skippedCount,
      totalHbMappedInDb: totalHbMappedInDb,
    });
  } catch (error: any) {
    console.error("ERROR IN SYNC-HB-SKU ROUTE:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Bir hata oluştu." },
      { status: 500 }
    );
  }
}
