/**
 * Sitedeki renk / beden yazısını pazaryeri listesindeki değerle karşılaştırır.
 * Büyük/küçük harf ve boşluk yok sayılır; bedenlerde eşdeğer yazımlar aynı kabul edilir
 * (XXL = 2XL, XXXL = 3XL, XXS = 2XS ...). Önceden bazı pazaryerlerinde (Pazarama, Idefix) XXL listede "2XL" olduğu için
 * otomatik eşleşmiyordu.
 */
function sizeKey(s: string): string {
    const t = s.toLocaleUpperCase("tr-TR").replace(/\s+/g, "").replace(/-?LARGE$/, "L").replace(/-?SMALL$/, "S");
    const m = t.match(/^(X{2,})([SL])$/);
    if (m) return `${m[1].length}X${m[2]}`;
    return t;
}

export function sameVariantValue(listValue: unknown, siteValue: unknown): boolean {
    const a = String(listValue ?? "").trim();
    const b = String(siteValue ?? "").trim();
    if (!a || !b) return false;
    if (a.toLocaleLowerCase("tr-TR") === b.toLocaleLowerCase("tr-TR")) return true;
    return sizeKey(a) === sizeKey(b);
}

/**
 * Listeden sitedeki değere karşılık gelen öğeyi bulur. Önce birebir / beden eşdeğeri; yoksa çok parçalı renklerde
 * ("Siyah / Mavi", "Siyah-Kırmızı") parçalara bakılır, son parça önce (ayırt edici renk genelde sondadır):
 * "Siyah / Mavi" → Mavi.
 */
export function pickVariantValue<T>(list: T[], siteValue: unknown, nameOf: (item: T) => unknown): T | undefined {
    const direct = list.find((x) => sameVariantValue(nameOf(x), siteValue));
    if (direct) return direct;
    const parts = String(siteValue ?? "")
        .split(/\s*[\/\-,+&]\s*/)
        .map((p) => p.trim())
        .filter(Boolean);
    if (parts.length < 2) return undefined;
    for (const part of [...parts].reverse()) {
        const hit = list.find((x) => sameVariantValue(nameOf(x), part));
        if (hit) return hit;
    }
    return undefined;
}
