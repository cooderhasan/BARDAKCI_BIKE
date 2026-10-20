/**
 * Yan menü (filtre) kategori sırası:
 * - Adında "denge" geçen önce (Denge Bisikleti)
 * - Adında jant ölçüsü geçenler ölçüye göre küçükten büyüğe (12 Jant, 14 Jant, 16 Jant, 20 Jant...)
 * - Diğerleri admin "Sıra" numarasına göre
 * - Adında "ekonomik" geçen en sonda
 * Jant/denge/ekonomik geçmeyen listelerde (üst kategoriler, motor) sıra admin'deki gibi kalır.
 * Aynı ölçüde (12 Jant Kız / 12 Jant Erkek) admin sırası, sonra ad.
 */
export function sortSidebarCategories<T extends { name: string; order?: number | null }>(list: T[]): T[] {
    const key = (c: T): [number, number] => {
        const n = c.name.toLocaleLowerCase("tr-TR");
        if (n.includes("denge")) return [0, 0];
        if (n.includes("ekonomik")) return [3, 0];
        const m = n.match(/(\d+(?:[.,]\d+)?)\s*jant/);
        if (m) return [1, parseFloat(m[1].replace(",", "."))];
        return [2, 0];
    };
    return list
        .map((c, i) => ({ c, i, k: key(c) }))
        .sort(
            (a, b) =>
                a.k[0] - b.k[0] ||
                a.k[1] - b.k[1] ||
                (a.c.order ?? 0) - (b.c.order ?? 0) ||
                a.c.name.localeCompare(b.c.name, "tr") ||
                a.i - b.i
        )
        .map((x) => x.c);
}
