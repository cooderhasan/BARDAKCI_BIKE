/**
 * Sipariş ekranı kargo filtresi: seçenekler siparişlerdeki gerçek kargo adlarından üretilir
 * (önceden sadece Yurtiçi/Aras sabitti; Sürat, Trendyol Express vb. "Diğer"e düşüyordu).
 * Aynı firmanın farklı yazımları ("SÜRAT KARGO", "Sürat Kargo") ilk kelimeye göre tek grupta toplanır.
 */
export type CargoGroup = { key: string; label: string; names: string[]; count: number };

export const NO_CARGO_KEY = "NONE";

export function cargoGroupKey(name: string): string {
    const first = name.trim().toLocaleUpperCase("tr-TR").split(/\s+/)[0] || "";
    return first
        .replace(/İ/g, "I")
        .replace(/Ş/g, "S")
        .replace(/Ü/g, "U")
        .replace(/Ç/g, "C")
        .replace(/Ö/g, "O")
        .replace(/Ğ/g, "G")
        .replace(/[^A-Z0-9]/g, "");
}

/** Sadece TAMAMI BÜYÜK harf olan adlar düzeltilir ("SÜRAT KARGO" → "Sürat Kargo"); "PTT Kargo", "HepsiJet" olduğu gibi kalır */
function prettyLabel(name: string): string {
    const t = name.trim();
    if (t !== t.toLocaleUpperCase("tr-TR")) return t;
    return t
        .toLocaleLowerCase("tr-TR")
        .split(/\s+/)
        .map((w) => w.charAt(0).toLocaleUpperCase("tr-TR") + w.slice(1))
        .join(" ");
}

export function buildCargoGroups(rows: { name: string | null; count: number }[]): CargoGroup[] {
    const groups = new Map<string, CargoGroup & { top: number }>();
    for (const r of rows) {
        if (!r.name || !r.name.trim()) continue;
        const key = cargoGroupKey(r.name);
        if (!key || key === NO_CARGO_KEY) continue;
        const g = groups.get(key) || { key, label: "", names: [], count: 0, top: -1 };
        g.names.push(r.name);
        g.count += r.count;
        // En çok kullanılan yazım etiket olur
        if (r.count > g.top) {
            g.top = r.count;
            g.label = prettyLabel(r.name);
        }
        groups.set(key, g);
    }
    return [...groups.values()]
        .sort((a, b) => b.count - a.count)
        .map(({ top, ...g }) => g);
}
