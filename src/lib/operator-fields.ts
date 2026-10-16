/**
 * Ürün güvenliği (iktisadi işletmeci) bilgileri: markaya tanımlı imalatçı / ithalatçı firmalarından
 * pazaryeri formlarındaki alanları önceden doldurmak için ortak yardımcılar.
 * Sadece yeni gönderim formlarını doldurur; kullanıcı formda değiştirebilir.
 */
export type OperatorFirmInfo = { name: string; address: string; email: string };
export type ProductOperators = { manufacturer: OperatorFirmInfo | null; importer: OperatorFirmInfo | null };

/** HB gibi tek satır isteyen alanlar için: "Ünvan - Adres - E-posta" */
export function operatorLine(f: OperatorFirmInfo): string {
    return [f.name, f.address, f.email].map((x) => (x || "").trim()).filter(Boolean).join(" - ");
}

function fieldOf(firm: OperatorFirmInfo, n: string, allowFullLine: boolean): string | null {
    if (/mail|e-posta|eposta/.test(n)) return firm.email || null;
    if (n.includes("adres")) return firm.address || null;
    if (/unvan|ünvan|isim|ismi|\badı\b|\bad\b/.test(n)) return firm.name || null;
    return allowFullLine ? operatorLine(firm) || null : null;
}

/**
 * Pazaryeri alan adına göre değer önerir; eşleşmezse null.
 * - Adında "ithalat" geçen alan ithalatçıdan, "üretici/imalat" geçen alan imalatçıdan doldurulur.
 * - İkincil / üçüncül ithalatçı alanları boş bırakılır.
 * - singleFirm (N11): alan adında rol yoksa tek firma istenir; ithalatçı varsa o, yoksa imalatçı kullanılır
 *   (sadece ünvan / adres / e-posta alanları).
 */
export function operatorValueFor(attrName: string, ops: ProductOperators | null | undefined, opts?: { singleFirm?: boolean }): string | null {
    if (!ops) return null;
    const n = (attrName || "").toLocaleLowerCase("tr-TR");
    if (/ikincil|üçüncül|ucuncul/.test(n)) return null;
    if (n.includes("ithalat")) return ops.importer ? fieldOf(ops.importer, n, true) : null;
    if (n.includes("üretici") || n.includes("uretici") || n.includes("imalat")) {
        return ops.manufacturer ? fieldOf(ops.manufacturer, n, true) : null;
    }
    if (opts?.singleFirm) {
        const firm = ops.importer || ops.manufacturer;
        if (!firm) return null;
        if (!/unvan|ünvan|adres|mail|e-posta|eposta/.test(n)) return null;
        return fieldOf(firm, n, false);
    }
    return null;
}

/** N11 "Sağlayıcı Tipi": ithalatçı tanımlıysa İthalatçı, değilse Üretici/İmalatçı seçeneği */
export function pickProviderTypeValue<T extends { name?: string }>(values: T[], ops: ProductOperators | null | undefined): T | null {
    if (!ops || (!ops.importer && !ops.manufacturer)) return null;
    const want = ops.importer ? /ithalat/ : /üretici|uretici|imalat/;
    return values.find((v) => want.test((v.name || "").toLocaleLowerCase("tr-TR"))) || null;
}
