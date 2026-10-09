/**
 * Pazaryeri eşleştirme raporu: "pazaryerinde satışta ama bizden stok gitmeyen" ilanları bulmak için ortak yardımcılar.
 * Entegra kapatıldıktan sonra bu ilanları güncelleyen başka sistem kalmadığı için fazla satış riski taşırlar.
 */

const STOCK_KEYS = ["availableStock", "AvailableStock", "stockQuantity", "StockQuantity", "stockCount", "stock", "quantity", "inventoryQuantity", "miktar"];
const ACTIVE_KEYS = ["onSale", "isSalable", "isActive", "active", "aktif"];
const BLOCKED_KEYS = ["archived", "isSuspended", "locked", "isLocked", "isFrozen"];

/** Pazaryerinden gelen ilan kaydı satışta ve stoklu mu? Stok alanı yoksa stokBilinmiyor=true döner. */
export function isListingLive(it: any): { live: boolean; stockKnown: boolean } {
  if (!it) return { live: false, stockKnown: false };
  if (BLOCKED_KEYS.some((k) => it[k] === true)) return { live: false, stockKnown: true };
  if (ACTIVE_KEYS.some((k) => it[k] === false)) return { live: false, stockKnown: true };
  const stockKey = STOCK_KEYS.find((k) => it[k] !== undefined && it[k] !== null);
  if (!stockKey) return { live: true, stockKnown: false };
  return { live: Number(it[stockKey]) > 0, stockKnown: true };
}

const sample = (arr: string[]) => arr.slice(0, 15).join(", ") + (arr.length > 15 ? ` …(+${arr.length - 15})` : "");

/**
 * orphans: pazaryerinde satışta, sitede karşılığı bulunmayan ilan kodları
 * liveButClosed: pazaryerinde satışta, sitede bu pazaryeri (veya ürün) kapalı olan ürün kodları
 */
export function formatListingReport(orphans: string[], liveButClosed: string[], stockKnown = true): string {
  const parts: string[] = [];
  if (orphans.length) parts.push(`DİKKAT: ${orphans.length} ilan pazaryerinde satışta ama sitede karşılığı yok (bunlara stok gitmiyor): ${sample(orphans)}`);
  if (liveButClosed.length) parts.push(`DİKKAT: ${liveButClosed.length} ilan satışta ama sitede bu pazaryeri kapalı (bunlara stok gitmiyor): ${sample(liveButClosed)}`);
  const note = stockKnown ? "" : " (pazaryeri stok bilgisi vermedi; stoksuz ilanlar da sayılmış olabilir)";
  return parts.length ? ` ${parts.join(" | ")}${note}` : " Satışta olup stok gitmeyen ilan yok.";
}
