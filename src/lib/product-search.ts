import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Türkçe'ye uygun ürün araması (arama sayfası, kategori içi arama ve header önerileri aynı mantığı kullanır).
 *
 * Önceden kelime ürün adında birebir aranıyordu:
 *  - "elcik" yazan "Elciği"ni bulamıyordu (ek gelince k -> ğ; lastik/lastiği, kask/kaskı da aynı)
 *  - "disli" yazan "Dişli"yi bulamıyordu (Türkçe harfler)
 *
 * Şimdi:
 *  - Hem aranan kelime hem ürün metni sadeleştirilir: küçük harf, ç/ğ/ı/ö/ş/ü -> c/g/i/o/s/u
 *  - Her kelimenin birkaç hali aranır: sondaki ek atılmış kök ve sert/yumuşak son ünsüz (k/g, t/d, p/b)
 *  - Ürün metni = ad + stok kodu + barkod + marka adı + varyantların rengi/bedeni/stok kodu/barkodu
 *  - Çok kelimede her kelime (herhangi bir haliyle) geçmeli
 * Tek SQL sorgusu; veritabanında ek sütun/eklenti gerekmez.
 */

const TR_MAP: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

export function normalizeTr(s: string): string {
    return s
        .toLocaleLowerCase("tr")
        .replace(/[çğıöşüâîû]/g, (c) => TR_MAP[c] || c)
        .replace(/̇/g, "")
        .trim();
}

// Sondaki ekler (sadeleştirilmiş harflerle); uzun olan önce denenir
const SUFFIXES = ["lari", "leri", "lar", "ler", "si", "su", "i", "u", "a", "e"];
const SOFT_HARD: Record<string, string> = { g: "k", k: "g", d: "t", t: "d", b: "p", p: "b" };
const MIN_LEN = 3;

/** Bir kelimenin aranacak halleri: kendisi, eki atılmış kökü ve son ünsüzün sert/yumuşak hali */
export function searchVariants(word: string): string[] {
    const w = normalizeTr(word);
    if (!w) return [];
    const bases = new Set<string>([w]);
    // Kısa kelimelerde ek atma (sele, kask, fren...) yanlış eşleşme üretir
    if (w.length >= 5) {
        for (const suf of SUFFIXES) {
            if (w.endsWith(suf) && w.length - suf.length >= 4) {
                bases.add(w.slice(0, -suf.length));
                break;
            }
        }
    }
    const out = new Set<string>();
    for (const b of bases) {
        if (b.length < MIN_LEN) continue;
        out.add(b);
        const last = b[b.length - 1];
        if (b.length >= 4 && SOFT_HARD[last]) out.add(b.slice(0, -1) + SOFT_HARD[last]);
    }
    return [...out];
}

export function splitSearchWords(q: string, max = 6): string[] {
    return q.trim().split(/\s+/).filter(Boolean).slice(0, max);
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => "\\" + c);

// SQL tarafında aynı sadeleştirme: önce büyük harfler (lower('İ') tr dışı harmanlamada noktalı i bırakır), sonra küçük
// chr(775) = birleşik nokta (U+0307); karşılığı olmadığı için translate onu siler
const sqlNorm = (expr: Prisma.Sql) =>
    Prisma.sql`translate(lower(translate(${expr}, 'ÇĞİIÖŞÜÂÎÛ', 'cgiiosuaiu')), 'çğıöşüâîû' || chr(775), 'cgiosuaiu')`;

/**
 * Aramaya uyan ürün ID'leri. stores verilirse sadece o mağazaların (BIKE/MOTOR/BOTH) ürünleri.
 * Kelime yoksa null döner (filtre uygulanmaz).
 */
export async function findProductIdsBySearch(
    q: string,
    opts: { stores?: string[]; activeOnly?: boolean } = {}
): Promise<string[] | null> {
    const words = splitSearchWords(q);
    if (words.length === 0) return null;

    const wordConds = words
        .map((w) => searchVariants(w))
        .filter((v) => v.length > 0)
        .map((variants) => {
            const patterns = variants.map((v) => `%${escapeLike(v)}%`);
            return Prisma.sql`s.txt LIKE ANY(${patterns}::text[])`;
        });
    if (wordConds.length === 0) return null;

    const filters: Prisma.Sql[] = [];
    if (opts.activeOnly) filters.push(Prisma.sql`p."isActive" = true`);
    if (opts.stores?.length) filters.push(Prisma.sql`p.store::text = ANY(${opts.stores}::text[])`);
    const where = filters.length ? Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}` : Prisma.empty;

    const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT s.id FROM (
            SELECT p.id, ${sqlNorm(Prisma.sql`concat_ws(' ', p.name, p.sku, p.barcode, b.name,
                (SELECT string_agg(concat_ws(' ', v.color, v.size, v.sku, v.barcode), ' ')
                   FROM product_variants v WHERE v."productId" = p.id))`)} AS txt
            FROM products p
            LEFT JOIN brands b ON b.id = p."brandId"
            ${where}
        ) s
        WHERE ${Prisma.join(wordConds, " AND ")}
    `);
    return rows.map((r) => r.id);
}

/** Kategori adı arama kelimelerine uyuyor mu (öneri kutusundaki kategori eşleşmesi için) */
export function nameMatchesSearch(name: string, q: string): boolean {
    const txt = normalizeTr(name);
    return splitSearchWords(q).every((w) => searchVariants(w).some((v) => txt.includes(v)));
}
