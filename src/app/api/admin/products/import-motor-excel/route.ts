import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import * as path from "path";
import { prisma } from "@/lib/db";

export const maxDuration = 300;

const USD_RATE = 47.0;
let isImporting = false;
let globalStatus = {
  status: "IDLE",
  importedCount: 0,
  skippedBikeCount: 0,
  skippedNoNameCount: 0,
  error: null as string | null,
};

function slugify(text: string): string {
  if (!text) return "";
  const trMap: Record<string, string> = {
    ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", İ: "i", ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u"
  };
  let cleaned = text
    .split("")
    .map((c) => trMap[c] || c)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return cleaned || "item-" + Math.floor(Math.random() * 1000000);
}

async function processImportInBackground() {
  if (isImporting) return;
  isImporting = true;
  globalStatus.status = "RUNNING";
  globalStatus.error = null;

  try {
    console.log("=== STARTING MOTOVITRIN EXCEL IMPORT IN BACKGROUND ===");
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
          console.log("[IMPORT-EXCEL] Found Excel file at path:", p);
          break;
        }
      } catch {}
    }

    if (!buffer) {
      const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.bardakcibike.com.tr";
      const fetchUrl = `${siteUrl}/tum_urunler.xlsx`;
      console.log("[IMPORT-EXCEL] Attempting HTTP fetch fallback for Excel:", fetchUrl);
      const res = await fetch(fetchUrl);
      if (res.ok) {
        const ab = await res.arrayBuffer();
        buffer = Buffer.from(ab);
      }
    }

    if (!buffer) {
      throw new Error("tum_urunler.xlsx dosyasına ulaşılamadı.");
    }

    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    let categoryMap = new Map<string, string>();
    let brandMap = new Map<string, string>();

    const existingBrands = await prisma.brand.findMany({ where: { store: "MOTOR" } });
    for (const b of existingBrands) {
      brandMap.set(b.name.toLowerCase().trim(), b.id);
    }

    const existingCategories = await prisma.category.findMany({ where: { store: "MOTOR" } });
    for (const c of existingCategories) {
      categoryMap.set(c.name.toLowerCase().trim(), c.id);
    }

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rawName = String(r["UrunAdi"] || "").trim();
      if (!rawName) {
        globalStatus.skippedNoNameCount++;
        continue;
      }

      const rawCategory = String(r["Ürün Kategori Adı"] || "").trim();
      const isBikeCategory =
        rawCategory.toLowerCase().includes("bisiklet") ||
        rawCategory.toLowerCase().includes("e-bike") ||
        rawName.toLowerCase().startsWith("bisiklet");

      if (isBikeCategory) {
        globalStatus.skippedBikeCount++;
        continue;
      }

      const isUSD = String(r["ParaBirimi"] || "").trim().toUpperCase() === "USD";
      const multiplier = isUSD ? USD_RATE : 1.0;

      const parsePrice = (val: any): number => {
        if (val === null || val === undefined || val === "") return 0;
        let num = Number(val);
        if (isNaN(num)) {
          num = parseFloat(String(val).replace(",", "."));
        }
        return isNaN(num) ? 0 : Math.round(num * multiplier * 100) / 100;
      };

      const eticaretPrice = parsePrice(r["Eticaret Fiyatı"]);
      const trendyolPrice = parsePrice(r["Trendyol Satış Fiyatı"]);
      const hepsiburadaPrice = parsePrice(r["HepsiBurada Satış Fiyatı"]);
      const pazaramaPrice = parsePrice(r["Pazarama Satış Fiyatı"]);
      const n11Price = parsePrice(r["N11 Satış Fiyatı"]);
      const ciceksepetiPrice = parsePrice(r["Çiçeksepeti Fiyatı"]);
      const pttavmPrice = parsePrice(r["Eptt Liste Fiyatı"]);

      const basePrice = eticaretPrice > 0 ? eticaretPrice : (trendyolPrice > 0 ? trendyolPrice : (hepsiburadaPrice > 0 ? hepsiburadaPrice : 0));
      const listPrice = basePrice;
      const salePrice = basePrice;

      const rawBrand = String(r["Marka"] || "Diğer").trim();
      let brandId: string | null = null;
      if (rawBrand) {
        const brandKey = rawBrand.toLowerCase();
        if (brandMap.has(brandKey)) {
          brandId = brandMap.get(brandKey)!;
        } else {
          let existingBrand = await prisma.brand.findFirst({
            where: { name: { equals: rawBrand, mode: "insensitive" } },
          });

          if (existingBrand) {
            brandId = existingBrand.id;
            brandMap.set(brandKey, existingBrand.id);
          } else {
            const brandSlug = slugify(rawBrand);
            let uniqueBrandSlug = brandSlug;
            let count = 1;
            while (await prisma.brand.findUnique({ where: { slug: uniqueBrandSlug } })) {
              uniqueBrandSlug = `${brandSlug}-${count++}`;
            }

            const newBrand = await prisma.brand.create({
              data: {
                name: rawBrand,
                slug: uniqueBrandSlug,
                store: "MOTOR",
              },
            });
            brandId = newBrand.id;
            brandMap.set(brandKey, newBrand.id);
          }
        }
      }

      let categoryId: string | null = null;
      if (rawCategory) {
        const parts = rawCategory.split(">").map((s) => s.trim()).filter(Boolean);
        let parentId: string | null = null;

        for (let pIdx = 0; pIdx < parts.length; pIdx++) {
          const partName = parts[pIdx];
          const partKey = `${pIdx}_${partName.toLowerCase()}_${parentId || "root"}`;

          if (categoryMap.has(partKey)) {
            parentId = categoryMap.get(partKey)!;
          } else {
            let existingCat = await prisma.category.findFirst({
              where: {
                name: { equals: partName, mode: "insensitive" },
                store: "MOTOR",
                parentId: parentId,
              },
            });

            if (existingCat) {
              parentId = existingCat.id;
              categoryMap.set(partKey, existingCat.id);
            } else {
              const catSlug = slugify(partName);
              let uniqueCatSlug = catSlug;
              let count = 1;
              while (await prisma.category.findUnique({ where: { slug: uniqueCatSlug } })) {
                uniqueCatSlug = `${catSlug}-${count++}`;
              }

              const newCat = await prisma.category.create({
                data: {
                  name: partName,
                  slug: uniqueCatSlug,
                  store: "MOTOR",
                  parentId: parentId,
                },
              });
              parentId = newCat.id;
              categoryMap.set(partKey, newCat.id);
            }
          }
        }
        categoryId = parentId;
      }

      const sku = String(r["Urun-Kodu"] || r["Barcode"] || `MTR-${i + 1}`).trim();
      const barcode = String(r["Barcode"] || r["Urun-Kodu"] || "").trim();

      const images: string[] = [];
      for (let imgIdx = 1; imgIdx <= 9; imgIdx++) {
        const imgUrl = String(r[`ImageURL${imgIdx}`] || "").trim();
        if (imgUrl && imgUrl.startsWith("http")) {
          images.push(imgUrl);
        }
      }

      const description = String(r["UrunAciklamasi"] || r["UrunAciklamasi1"] || rawName).trim();
      const stock = Number(r["Ürün Adedi"]) || 0;
      const desi = Number(r["Ürün Desi"]) || 0;

      const baseSlug = slugify(rawName);
      let uniqueSlug = baseSlug;
      let slugCounter = 1;
      while (await prisma.product.findUnique({ where: { slug: uniqueSlug } })) {
        uniqueSlug = `${baseSlug}-${sku ? slugify(sku) : slugCounter++}`;
      }

      const product = await prisma.product.upsert({
        where: { sku: sku },
        create: {
          name: rawName,
          slug: uniqueSlug,
          sku: sku,
          barcode: barcode || null,
          brand: brandId ? { connect: { id: brandId } } : undefined,
          categories: categoryId ? { connect: [{ id: categoryId }] } : undefined,
          category: categoryId ? { connect: { id: categoryId } } : undefined,
          description: description,
          listPrice: listPrice,
          salePrice: salePrice,
          trendyolPrice: trendyolPrice > 0 ? trendyolPrice : null,
          hepsiburadaPrice: hepsiburadaPrice > 0 ? hepsiburadaPrice : null,
          pazaramaPrice: pazaramaPrice > 0 ? pazaramaPrice : null,
          n11Price: n11Price > 0 ? n11Price : null,
          ciceksepetiPrice: ciceksepetiPrice > 0 ? ciceksepetiPrice : null,
          pttavmPrice: pttavmPrice > 0 ? pttavmPrice : null,
          stock: stock,
          desi: desi > 0 ? desi : null,
          images: images,
          store: "MOTOR",
          isActive: true,
          isTrendyolActive: Boolean(r["Trendyol Baglı Durumu"]),
          isHepsiburadaActive: Boolean(r["HB Baglı Durumu"]),
          isN11Active: Boolean(r["N11 Baglı Durumu"]),
          isPazaramaActive: Boolean(r["Pazarama Bağlılık Durumu"]),
          isPttavmActive: Boolean(r["EPTT Baglı Durumu"]),
          isCiceksepetiActive: Boolean(r["Ciceksepeti Baglı Durumu"]),
        },
        update: {
          name: rawName,
          barcode: barcode || undefined,
          brand: brandId ? { connect: { id: brandId } } : undefined,
          categories: categoryId ? { set: [{ id: categoryId }] } : undefined,
          category: categoryId ? { connect: { id: categoryId } } : undefined,
          description: description,
          listPrice: listPrice,
          salePrice: salePrice,
          trendyolPrice: trendyolPrice > 0 ? trendyolPrice : undefined,
          hepsiburadaPrice: hepsiburadaPrice > 0 ? hepsiburadaPrice : undefined,
          pazaramaPrice: pazaramaPrice > 0 ? pazaramaPrice : undefined,
          n11Price: n11Price > 0 ? n11Price : undefined,
          ciceksepetiPrice: ciceksepetiPrice > 0 ? ciceksepetiPrice : undefined,
          pttavmPrice: pttavmPrice > 0 ? pttavmPrice : undefined,
          stock: stock,
          desi: desi > 0 ? desi : undefined,
          images: images.length > 0 ? images : undefined,
          store: "MOTOR",
          isActive: true,
        },
      });

      const hbSku = String(r["HB Sku"] || "").trim();
      if (hbSku) {
        await prisma.hepsiburadaProduct.upsert({
          where: { productId: product.id },
          create: {
            productId: product.id,
            hbSku: hbSku,
            merchantSku: sku || barcode,
            isSynced: true,
          },
          update: {
            hbSku: hbSku,
            merchantSku: sku || barcode,
            isSynced: true,
          },
        });
      }

      globalStatus.importedCount++;
    }

    globalStatus.status = "COMPLETED";
    console.log("=== EXCEL IMPORT FINISHED IN BACKGROUND SUCCESSFULLY ===");
  } catch (err: any) {
    console.error("BACKGROUND IMPORT ERROR:", err);
    globalStatus.status = "ERROR";
    globalStatus.error = err.message || "Bilinmeyen hata";
  } finally {
    isImporting = false;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const isStatusCheck = searchParams.get("status") === "true";

  // Real-time DB count of Motor products
  const dbMotorProductCount = await prisma.product.count({ where: { store: "MOTOR" } });

  if (isStatusCheck) {
    return NextResponse.json({
      success: true,
      status: globalStatus.status,
      dbMotorProductCount,
      importedInCurrentRun: globalStatus.importedCount,
      skippedBikeCount: globalStatus.skippedBikeCount,
      error: globalStatus.error,
    });
  }

  // Trigger background process without blocking HTTP response
  processImportInBackground().catch((err) => console.error("Process error:", err));

  return NextResponse.json({
    success: true,
    message: "Motor ürünlerinin aktarımı arka planda başlatıldı! İlerleme durumunu ?status=true ekleyerek takip edebilirsiniz.",
    dbMotorProductCount,
    statusUrl: `${req.nextUrl.pathname}?status=true`,
  });
}
