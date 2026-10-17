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
