import * as XLSX from "xlsx";
import * as path from "path";
import { prisma } from "../src/lib/db";

async function syncHbSkus() {
  console.log("=== SYNCING HEPSIBURADA SKUS FROM EXCEL ===");

  let buffer: Buffer | null = null;
  const candidatePaths = [
    path.join(process.cwd(), "public", "tum_urunler.xlsx"),
    path.join(process.cwd(), "tum_urunler.xlsx"),
  ];

  for (const p of candidatePaths) {
    if (require("fs").existsSync(p)) {
      buffer = require("fs").readFileSync(p);
      console.log("Reading file:", p);
      break;
    }
  }

  if (!buffer) {
    console.error("tum_urunler.xlsx file not found");
    return;
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

  console.log("\n=== HEPSIBURADA SKU SYNC COMPLETED ===");
  console.log(`Successfully Linked Hepsiburada SKUs: ${linkedCount}`);
  console.log(`Skipped Rows (No HB Sku): ${skippedCount}`);
}

syncHbSkus()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("ERROR SYNCING HB SKUS:", err);
    process.exit(1);
  });
