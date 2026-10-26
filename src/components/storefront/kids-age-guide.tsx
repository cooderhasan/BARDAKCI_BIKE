import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Cat = { name: string; slug: string; children?: { name: string; slug: string }[] };

// Jant ölçüsüne göre yaş aralığı: mağazadaki ürün adlarında kullanılan aralıklar (ör. "16 Jant ... 4-7 Yaş Uyumlu").
// Listede olmayan ölçü (ör. 15 jant) kutucuk olarak gösterilmez.
const AGE_BY_RIM: Record<number, string> = { 12: "2–4", 14: "3–5", 16: "4–7", 20: "5–8" };
const BALANCE_AGE = "2–4";

type Tile = { key: string; size: string; unit?: string; age: string; links: { text: string; href: string }[] };

/**
 * "Yaşa Göre Çocuk Bisikleti": Çocuk Bisikleti alt kategorilerinden (Denge, 12/14/16/20 jant, kız/erkek) kutucuklar.
 * Veri layout'ta zaten çekilen kategori ağacından gelir; ek sorgu ve tarayıcı JS'i yok.
 * Alt kategori adı/adresi admin'de değişirse kutucuklar kendiliğinden güncellenir.
 */
export function KidsAgeGuide({ categories }: { categories: Cat[] }) {
    const kids =
        categories.find((c) => c.slug === "cocuk-bisikleti") ||
        categories.find((c) => /çocuk/i.test(c.name) && !/ekonomik/i.test(c.name));
    const children = kids?.children || [];

    const tiles: Tile[] = [];
    const balance = children.find((c) => /denge/i.test(c.name));
    if (balance) {
        tiles.push({ key: "denge", size: "Denge", age: BALANCE_AGE, links: [{ text: "İncele", href: `/category/${balance.slug}` }] });
    }
    for (const rim of Object.keys(AGE_BY_RIM).map(Number)) {
        const matches = children.filter((c) => {
            const m = c.name.match(/(\d+(?:[.,]\d+)?)\s*jant/i);
            return m && Number(m[1].replace(",", ".")) === rim;
        });
        if (matches.length === 0) continue;
        const girl = matches.find((c) => /kız|kiz/i.test(c.name.toLocaleLowerCase("tr")));
        const boy = matches.find((c) => /erkek/i.test(c.name));
        const links = girl || boy
            ? [girl && { text: "Kız", href: `/category/${girl.slug}` }, boy && { text: "Erkek", href: `/category/${boy.slug}` }].filter(Boolean) as Tile["links"]
            : [{ text: "İncele", href: `/category/${matches[0].slug}` }];
        tiles.push({ key: String(rim), size: `${rim}″`, unit: "jant", age: AGE_BY_RIM[rim], links });
    }

    if (tiles.length < 2) return null;

    return (
        <section>
            <div className="flex items-end justify-between gap-4 mb-4 md:mb-5">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="h-px w-6 bg-[#17457C] dark:bg-blue-400" />
                        <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.18em] text-[#17457C] dark:text-blue-400">
                            Doğru Ölçüyü Seçin
                        </span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                        Yaşa Göre Çocuk Bisikleti
                    </h2>
                </div>
                {kids && (
                    <Link
                        href={`/category/${kids.slug}`}
                        className="group/all shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[#17457C]/20 bg-white dark:bg-gray-900 dark:border-gray-700 px-3.5 py-2 text-xs md:text-sm font-semibold text-[#17457C] dark:text-blue-300 hover:bg-[#17457C] hover:text-white hover:border-[#17457C] transition-colors"
                    >
                        Tümünü Gör
                        <ArrowRight className="h-3.5 w-3.5 md:h-4 md:w-4 transition-transform group-hover/all:translate-x-0.5" />
                    </Link>
                )}
            </div>

            {/* Telefonda yana kaydırılır (sayfa uzamasın), büyük ekranda tek satır */}
            <div
                className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0 md:grid md:gap-4 md:overflow-visible"
                style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}
            >
                {tiles.map((t) => (
                    <div
                        key={t.key}
                        className="snap-start shrink-0 w-[42%] sm:w-[30%] md:w-auto rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/60 dark:ring-gray-700 p-3.5 md:p-4 flex flex-col"
                    >
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#17457C] dark:text-blue-300">{t.size}</span>
                            {t.unit && <span className="text-xs font-semibold text-gray-400">{t.unit}</span>}
                        </div>
                        <div className="mt-0.5 text-sm font-semibold text-gray-700 dark:text-gray-200">{t.age} yaş</div>
                        <div className="mt-3 flex gap-1.5">
                            {t.links.map((l) => (
                                <Link
                                    key={l.href}
                                    href={l.href}
                                    className="flex-1 inline-flex h-9 items-center justify-center rounded-lg bg-[#17457C]/[0.06] dark:bg-blue-900/30 text-xs md:text-sm font-semibold text-[#17457C] dark:text-blue-300 hover:bg-[#17457C] hover:text-white transition-colors"
                                >
                                    {l.text}
                                </Link>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
