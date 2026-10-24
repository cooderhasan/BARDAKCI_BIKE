import { prisma } from "@/lib/db";
import { getAllFAQs } from "@/app/actions/faq";
import {
    resolveLlmsContext, introLines, getCategoryTree, getCatalogBrands, formatPriceTr, stripHtml, shortText, markdownResponse,
    AUTHORIZED_BIKE_BRANDS,
} from "@/lib/llms-content";

export const revalidate = 3600; // 1 saat önbellekleme (ISR)

/** llmstxt.org biçiminde mağaza özeti: yapay zeka modelleri siteyi buradan tanır. Ayrıntılı katalog llms-full.txt'de. */
export async function GET(req: Request) {
    const ctx = resolveLlmsContext(req);
    const { baseUrl, isMotor, storeFilter, siteName } = ctx;

    const [categories, brands, products, faqs] = await Promise.all([
        getCategoryTree(ctx).catch(() => []),
        getCatalogBrands(ctx).catch(() => [] as string[]),
        prisma.product
            .findMany({
                where: { isActive: true, store: storeFilter as any, stock: { gt: 0 } },
                orderBy: [{ isBestSeller: "desc" }, { isFeatured: "desc" }, { updatedAt: "desc" }],
                take: 25,
                select: {
                    name: true, slug: true, listPrice: true, salePrice: true,
                    brand: { select: { name: true } },
                    categories: { select: { name: true }, take: 1 },
                },
            })
            .catch(() => [] as any[]),
        getAllFAQs(true, ctx.store).then((f) => (f || []).slice(0, 8)).catch(() => [] as any[]),
    ]);

    const lines = introLines(ctx, isMotor ? `${siteName} — Motosiklet Yedek Parça ve Aksesuar` : `${siteName} — Bisiklet, Yedek Parça ve Aksesuar`);

    if (categories.length > 0) {
        lines.push("## Ana Kategoriler");
        for (const c of categories) {
            const subs = c.children.length > 0 ? ` — alt kategoriler: ${c.children.slice(0, 12).map((s) => s.name).join(", ")}${c.children.length > 12 ? "…" : ""}` : "";
            lines.push(`- [${c.name}](${baseUrl}/category/${c.slug})${subs}`);
        }
        lines.push("");
    }

    if (products.length > 0) {
        lines.push("## Öne Çıkan Ürünler (stokta)");
        for (const p of products) {
            const sale = p.salePrice && Number(p.salePrice) > 0 && Number(p.salePrice) < Number(p.listPrice) ? p.salePrice : p.listPrice;
            const brand = p.brand?.name ? ` | ${p.brand.name}` : "";
            const cat = p.categories?.[0]?.name ? ` | ${p.categories[0].name}` : "";
            lines.push(`- [${p.name}](${baseUrl}/products/${p.slug}): ${formatPriceTr(sale)}${brand}${cat}`);
        }
        lines.push("");
    }

    if (brands.length > 0 || !isMotor) {
        lines.push("## Markalar");
        if (!isMotor) lines.push(`- **Yetkili satıcısı olduğumuz markalar:** ${AUTHORIZED_BIKE_BRANDS.join(", ")}`);
        if (brands.length > 0) lines.push(`- **Satılan markalar:** ${brands.join(", ")}`);
        lines.push("");
    }

    if (faqs.length > 0) {
        lines.push("## Sıkça Sorulan Sorular");
        for (const f of faqs) {
            lines.push(`- **${f.question}**`);
            lines.push(`  ${shortText(stripHtml(f.answer), 320)}`);
        }
        lines.push("");
    }

    lines.push("## Bilgi Sayfaları");
    lines.push(`- [Sıkça Sorulan Sorular](${baseUrl}/sss): Kargo, ödeme, garanti ve iade.`);
    lines.push(`- [Hakkımızda](${baseUrl}/about)`);
    lines.push(`- [İletişim](${baseUrl}/contact): Adres, telefon, çalışma saatleri.`);
    lines.push(`- [İptal ve İade Koşulları](${baseUrl}/policies/cancellation)`);
    lines.push(`- [Gizlilik Politikası](${baseUrl}/policies/privacy)`);
    lines.push("");

    lines.push("## Optional");
    lines.push(`- [Ayrıntılı katalog (llms-full.txt)](${baseUrl}/llms-full.txt): Ürünler, fiyatlar, stok durumu ve tüm SSS.`);
    lines.push(`- [Site haritası](${baseUrl}/sitemap.xml)`);
    lines.push("");

    return markdownResponse(lines.join("\n"));
}
