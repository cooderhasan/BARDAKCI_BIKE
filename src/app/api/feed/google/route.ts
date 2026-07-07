import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Google Merchant Center Shopping Feed (RSS 2.0 / Atom XML)
// URL: /api/feed/google
// Bu URL'yi Google Merchant Center > Ürünler > Veri Kaynakları > Zamanlanmış Getirme'ye ekleyin.

export const dynamic = "force-dynamic";
export const revalidate = 0;

function escapeXml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(request: Request) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.bardakcibike.com.tr";

    // Aktif ve Google'a işaretlenmiş ürünleri çek
    const products = await (prisma as any).product.findMany({
      where: {
        isActive: true,
        isGoogleActive: true,
      },
      include: {
        brand: true,
        categories: true,
        category: true, // Legacy category field
      },
      orderBy: { updatedAt: "desc" },
      take: 5000, // Google limit
    });

    const now = new Date().toUTCString();

    let items = "";

    for (const product of products) {
      const price = product.googlePrice ?? product.salePrice ?? product.listPrice;
      const priceFormatted = `${Number(price).toFixed(2)} TRY`;

      // Kategori ve Google Kategori eşleştirmesi
      // Hem yeni 'categories' dizisine hem de eski 'category' alanına bakıyoruz
      const mainCatData = product.categories?.[0] || product.category;
      const productTypeName = mainCatData?.name || "";
      
      const googleCategoryFallback = "Spor ve Fitness > Açık Hava Aktiviteleri > Bisiklet";
      
      const googleCategory = 
        product.categories?.find((c: any) => c.googleProductCategory && c.googleProductCategory.trim() !== "")?.googleProductCategory || 
        (product.category?.googleProductCategory && product.category.googleProductCategory.trim() !== "" ? product.category.googleProductCategory : null) || 
        googleCategoryFallback;

      // Ensure image URLs are absolute
      const getAbsoluteUrl = (path: string) => {
          if (!path) return "";
          if (path.startsWith("http")) return path;
          return `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
      };

      const imageUrl = getAbsoluteUrl(product.images?.[0] || "");
      const productUrl = `${baseUrl}/urun/${escapeXml(product.slug)}`;
      const availability = product.stock > 0 ? "in_stock" : "out_of_stock";

      // GTIN: önce product.gtin, yoksa product.barcode
      const gtin = product.gtin || product.barcode || "";
      const mpn = product.mpn || product.sku || "";

      const descriptionRaw = product.description
        ? product.description.replace(/<[^>]*>/g, "").substring(0, 5000)
        : product.name;
        
      // Shipping Weight
      const weight = product.weight ? Number(product.weight) : null;
      const weightFormatted = weight ? `${weight.toFixed(2)} kg` : "";

      // Dynamic Extraction of missing attributes for Google Merchant Center
      const getColor = (name: string): string => {
        const colors = [
          "Mint Yeşili", "Mint Yeşil", "Siyah Kırmızı", "Antrasit Gri", "Gri Turuncu", "Siyah Turuncu", "Siyah Mavi",
          "Beyaz Kırmızı", "Beyaz Mor", "Beyaz Pembe", "Metalik Gri", "Mor", "Sarı", "Pembe", "Gri", "Turuncu", 
          "Kırmızı", "Beyaz", "Siyah", "Antrasit", "Fuşya", "Mavi", "Yeşil", "Turkuaz", "Krom", "Gold", "Gümüş", "Bordo"
        ];
        const lowerName = name.toLowerCase();
        for (const color of colors) {
          if (lowerName.includes(color.toLowerCase())) {
            return color;
          }
        }
        return "";
      };

      const getSize = (name: string): string => {
        const sizeMatch = name.match(/(\d+(?:\.\d+)?\s*(?:Jant|J|″|"))/i) || name.match(/(\d+\s*cm)/i) || name.match(/(\d+\s*Kadro)/i);
        return sizeMatch ? sizeMatch[0] : "";
      };

      const getGender = (name: string, dbGender?: string | null): string => {
        if (dbGender) {
          const lowerDb = dbGender.toLowerCase();
          if (lowerDb.includes("kadın") || lowerDb.includes("kız") || lowerDb.includes("lady") || lowerDb.includes("female")) return "female";
          if (lowerDb.includes("erkek") || lowerDb.includes("bay") || lowerDb.includes("male")) return "male";
          return "unisex";
        }
        const lowerName = name.toLowerCase();
        if (lowerName.includes("kız") || lowerName.includes("bayan") || lowerName.includes("kadın") || lowerName.includes("lady") || lowerName.includes("queen") || lowerName.includes("sweera") || lowerName.includes("actress")) return "female";
        if (lowerName.includes("erkek") || lowerName.includes("man") || lowerName.includes("boy") || lowerName.includes("tiger")) return "male";
        return "unisex";
      };

      const getAgeGroup = (name: string): string => {
        const lowerName = name.toLowerCase();
        if (lowerName.includes("çocuk") || lowerName.includes("kız çocuk") || lowerName.includes("erkek çocuk") || lowerName.includes("bebek") || lowerName.includes("yaş") || lowerName.includes("bobo") || lowerName.includes("rose") || lowerName.includes("lily") || lowerName.includes("stitch") || lowerName.includes("lovely") || lowerName.includes("actress") || lowerName.includes("queen")) return "kids";
        
        const jantMatch = name.match(/(\d+)\s*(?:Jant|J|″|")/i);
        if (jantMatch) {
          const jantSize = parseInt(jantMatch[1]);
          if (jantSize <= 20) return "kids";
        }
        return "adult";
      };

      const extractedColor = getColor(product.name);
      const extractedSize = getSize(product.name);
      const extractedGender = getGender(product.name, product.gender);
      const extractedAgeGroup = getAgeGroup(product.name);

      items += `
    <item>
      <g:id>${escapeXml(product.id)}</g:id>
      <g:title>${escapeXml(product.name)}</g:title>
      <g:description>${escapeXml(descriptionRaw)}</g:description>
      <g:link>${productUrl}</g:link>
      ${imageUrl ? `<g:image_link>${escapeXml(imageUrl)}</g:image_link>` : ""}
      ${product.images?.[1] ? `<g:additional_image_link>${getAbsoluteUrl(product.images[1])}</g:additional_image_link>` : ""}
      <g:availability>${availability}</g:availability>
      <g:price>${priceFormatted}</g:price>
      ${product.salePrice && Number(product.salePrice) < Number(product.listPrice) ? `<g:sale_price>${Number(product.salePrice).toFixed(2)} TRY</g:sale_price>` : ""}
      <g:condition>new</g:condition>
      ${googleCategory ? `<g:google_product_category>${escapeXml(googleCategory)}</g:google_product_category>` : ""}
      ${productTypeName ? `<g:product_type>${escapeXml(productTypeName)}</g:product_type>` : ""}
      ${product.brand?.name ? `<g:brand>${escapeXml(product.brand.name)}</g:brand>` : ""}
      ${gtin ? `<g:gtin>${escapeXml(gtin)}</g:gtin>` : ""}
      ${mpn ? `<g:mpn>${escapeXml(mpn)}</g:mpn>` : ""}
      ${extractedColor ? `<g:color>${escapeXml(extractedColor)}</g:color>` : ""}
      ${extractedSize ? `<g:size>${escapeXml(extractedSize)}</g:size>` : ""}
      <g:gender>${escapeXml(extractedGender)}</g:gender>
      <g:age_group>${escapeXml(extractedAgeGroup)}</g:age_group>
      ${weightFormatted ? `<g:shipping_weight>${weightFormatted}</g:shipping_weight>` : ""}
      ${product.sku ? `<g:item_group_id>${escapeXml(product.sku)}</g:item_group_id>` : ""}
    </item>`;
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Ürün Kataloğu</title>
    <link>${baseUrl}</link>
    <description>Google Merchant Center Ürün Beslemesi</description>
    <g:content_language>tr</g:content_language>
    <g:target_country>TR</g:target_country>
    <pubDate>${now}</pubDate>
    ${items}
  </channel>
</rss>`;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("Google Feed Error:", error);
    return new NextResponse(`Feed hatası: ${error.message}`, { status: 500 });
  }
}
