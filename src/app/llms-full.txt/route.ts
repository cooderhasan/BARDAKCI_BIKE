import { prisma } from "@/lib/db";
import { getAllFAQs } from "@/app/actions/faq";
import {
    resolveLlmsContext, introLines, getCategoryTree, getCatalogBrands, formatPriceTr, stripHtml, shortText, markdownResponse,
    AUTHORIZED_BIKE_BRANDS,
} from "@/lib/llms-content";

export const revalidate = 3600; // 1 saat önbellek

/** Ayrıntılı katalog: kategori ağacı, ürünler (fiyat, stok, kısa açıklama), tüm SSS */
export async function GET(req: Request) {
    const ctx = resolveLlmsContext(req);
    const { baseUrl, isMotor, storeFilter, siteName } = ctx;

    const [categories, brands, products, faqs] = await Promise.all([
        getCategoryTree(ctx).catch(() => []),
        getCatalogBrands(ctx).catch(() => [] as string[]),
        prisma.product
            .findMany({
                where: { isActive: true, store: storeFilter as any },
                orderBy: [{ isBestSeller: "desc" }, { stock: "desc" }, { updatedAt: "desc" }],
                take: 200,
                select: {
                    name: true, slug: true, sku: true, listPrice: true, salePrice: true, stock: true,
                    brakeType: true, gender: true, description: true,
                    brand: { select: { name: true } },
                    categories: { select: { name: true }, take: 1 },
                },
            })
            .catch(() => [] as any[]),
        getAllFAQs(true, ctx.store).catch(() => [] as any[]),
    ]);

    const lines = introLines(ctx, `${siteName} — Ayrıntılı Ürün Kataloğu`);

    if (categories.length > 0) {
        lines.push("## Kategoriler");
        for (const c of categories) {
            const desc = c.description ? ` — ${shortText(stripHtml(c.description), 200)}` : "";
            lines.push(`- [${c.name}](${baseUrl}/category/${c.slug})${desc}`);
            for (const s of c.children) lines.push(`  - [${s.name}](${baseUrl}/category/${s.slug})`);
        }
        lines.push("");
    }

    lines.push("## Markalar");
    if (!isMotor) lines.push(`- **Yetkili satıcısı olduğumuz markalar:** ${AUTHORIZED_BIKE_BRANDS.join(", ")}`);
    if (brands.length > 0) lines.push(`- **Satılan markalar:** ${brands.join(", ")}`);
    lines.push("");

    if (products.length > 0) {
        lines.push("## Ürünler");
        lines.push("Fiyatlar KDV dahildir; güncel fiyat ve stok için ürün sayfası esastır.");
        lines.push("");
        for (const p of products) {
            const discounted = p.salePrice && Number(p.salePrice) > 0 && Number(p.salePrice) < Number(p.listPrice);
            const price = discounted ? `${formatPriceTr(p.salePrice)} (indirimli; liste fiyatı ${formatPriceTr(p.listPrice)})` : formatPriceTr(p.listPrice);
            const info = [
                p.brand?.name ? `Marka: ${p.brand.name}` : "",
                p.categories?.[0]?.name ? `Kategori: ${p.categories[0].name}` : "",
                p.brakeType ? `Fren: ${p.brakeType}` : "",
                p.gender ? `Kullanıcı: ${p.gender}` : "",
                p.sku ? `Stok kodu: ${p.sku}` : "",
            ].filter(Boolean);
            lines.push(`### [${p.name}](${baseUrl}/products/${p.slug})`);
            lines.push(`- **Fiyat:** ${price} | **Stok:** ${p.stock > 0 ? "Var" : "Tükendi"}`);
            if (info.length > 0) lines.push(`- ${info.join(" | ")}`);
            const desc = shortText(stripHtml(p.description), 300);
            if (desc) lines.push(`- ${desc}`);
            lines.push("");
        }
    }

    if (faqs.length > 0) {
        lines.push("## Sıkça Sorulan Sorular");
        for (const f of faqs) {
            lines.push(`### ${f.question}`);
            lines.push(stripHtml(f.answer));
            lines.push("");
        }
    }

    return markdownResponse(lines.join("\n"));
}
