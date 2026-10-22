/**
 * Site siparişlerinin ziyaret kaynağı (Google, direkt, Instagram...) ve cihazı (telefon/masaüstü).
 * Kaynak müşterinin tarayıcısında tutulur (üçüncü taraf yok); sipariş verilirken siparişe yazılır.
 * Kural "son direkt olmayan ziyaret": Google'dan gelip ertesi gün adresi yazarak dönüp alan müşteri Google sayılır (30 gün).
 */

export interface VisitSource {
    referrer?: string; // gelinen sitenin adı (ör. www.google.com)
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    gclid?: boolean; // Google Ads tıklaması
    fbclid?: boolean; // Facebook/Instagram tıklaması
    landing?: string; // ilk açılan sayfa
    at?: string; // ziyaret zamanı (ISO)
}

export interface OrderAttribution extends VisitSource {
    device?: "Telefon" | "Tablet" | "Masaüstü";
    os?: string;
    browser?: string;
}

const KEY = "visit_source_v1";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const clip = (v: unknown, n = 200) => (typeof v === "string" && v ? v.slice(0, n) : undefined);

/** Her sayfa açılışında (tarayıcıda) çağrılır */
export function captureVisitSource() {
    try {
        const url = new URL(window.location.href);
        const q = url.searchParams;
        let referrer: string | undefined;
        if (document.referrer) {
            const host = new URL(document.referrer).hostname;
            // Kendi sitemiz ve ödeme sayfası (PayTR dönüşü) kaynak sayılmaz
            const own = host === window.location.hostname || host.endsWith("bardakcibike.com.tr") || host.endsWith("motovitrin.com") || host.includes("paytr");
            if (!own) referrer = host;
        }
        const next: VisitSource = {
            referrer,
            utmSource: clip(q.get("utm_source"), 100),
            utmMedium: clip(q.get("utm_medium"), 100),
            utmCampaign: clip(q.get("utm_campaign"), 100),
            gclid: q.has("gclid") || q.has("gbraid") || q.has("wbraid") || undefined,
            fbclid: q.has("fbclid") || undefined,
        };
        const isDirect = !next.referrer && !next.utmSource && !next.gclid && !next.fbclid;
        const prev = readVisitSource();
        // Direkt girişte, 30 gün içindeki direkt olmayan kaynak korunur
        if (isDirect && prev) return;
        if (!isDirect || !prev) {
            localStorage.setItem(KEY, JSON.stringify({ ...next, landing: clip(url.pathname, 200), at: new Date().toISOString() }));
        }
    } catch {
        // tarayıcı depolaması kapalı olabilir; özellik sessizce çalışmaz
    }
}

export function readVisitSource(): VisitSource | null {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const v = JSON.parse(raw) as VisitSource;
        if (v.at && Date.now() - new Date(v.at).getTime() > TTL_MS) return null;
        return v;
    } catch {
        return null;
    }
}

/** Sunucuda: tarayıcıdan gelen veriyi temizler (sadece bilinen alanlar, kısa metin) */
export function sanitizeVisitSource(v: any): VisitSource {
    if (!v || typeof v !== "object") return {};
    return {
        referrer: clip(v.referrer, 120),
        utmSource: clip(v.utmSource, 100),
        utmMedium: clip(v.utmMedium, 100),
        utmCampaign: clip(v.utmCampaign, 100),
        gclid: v.gclid === true || undefined,
        fbclid: v.fbclid === true || undefined,
        landing: clip(v.landing, 200),
        at: clip(v.at, 40),
    };
}

/** Sunucuda: tarayıcı bilgisinden (User-Agent) cihaz, işletim sistemi, tarayıcı */
export function parseUserAgent(ua: string | null | undefined): Pick<OrderAttribution, "device" | "os" | "browser"> {
    const s = ua || "";
    if (!s) return {};
    const isTablet = /iPad|Tablet|PlayBook|Silk/i.test(s) || (/Android/i.test(s) && !/Mobile/i.test(s));
    const isMobile = !isTablet && /Mobi|iPhone|iPod|Android|Windows Phone/i.test(s);
    const os = /iPhone|iPad|iPod/i.test(s) ? "iOS"
        : /Android/i.test(s) ? "Android"
        : /Windows/i.test(s) ? "Windows"
        : /Mac OS X|Macintosh/i.test(s) ? "macOS"
        : /Linux/i.test(s) ? "Linux" : undefined;
    const browser = /SamsungBrowser/i.test(s) ? "Samsung Internet"
        : /Edg\//i.test(s) ? "Edge"
        : /OPR\/|Opera/i.test(s) ? "Opera"
        : /YaBrowser/i.test(s) ? "Yandex"
        : /Instagram/i.test(s) ? "Instagram uygulaması"
        : /FBAN|FBAV/i.test(s) ? "Facebook uygulaması"
        : /CriOS|Chrome/i.test(s) ? "Chrome"
        : /FxiOS|Firefox/i.test(s) ? "Firefox"
        : /Safari/i.test(s) ? "Safari" : undefined;
    return { device: isTablet ? "Tablet" : isMobile ? "Telefon" : "Masaüstü", os, browser };
}

/** Admin'de gösterilecek kaynak adı */
export function describeVisitSource(a: OrderAttribution | null | undefined): string {
    if (!a) return "Bilinmiyor";
    const ref = (a.referrer || "").toLowerCase();
    const utm = (a.utmSource || "").toLowerCase();
    const medium = (a.utmMedium || "").toLowerCase();
    if (a.gclid || (utm.includes("google") && /cpc|ppc|paid|ads/.test(medium))) return "Google Reklam";
    if (utm.includes("merchant") || utm.includes("shopping")) return "Google Alışveriş";
    if (/(^|\.)google\./.test(ref)) return "Google (arama)";
    if (/(^|\.)(bing|yandex|duckduckgo|yahoo)\./.test(ref)) return `Arama motoru (${ref.replace(/^www\./, "")})`;
    if (a.fbclid || utm.includes("instagram") || utm.includes("facebook") || /instagram|facebook|fb\.com/.test(ref)) {
        return utm.includes("instagram") || ref.includes("instagram") ? "Instagram" : "Facebook / Instagram";
    }
    if (a.utmSource) return `Kampanya: ${a.utmSource}`;
    if (ref) return `Başka site: ${ref.replace(/^www\./, "")}`;
    return "Direkt (adres yazarak / yer imi)";
}
