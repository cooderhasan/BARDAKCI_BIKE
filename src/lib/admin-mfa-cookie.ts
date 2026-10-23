/**
 * Yönetim paneli iki adımlı doğrulama çerezi: kod doğru girilince bu tarayıcıya verilir.
 * İçerik "kullanıcıId.bitişZamanı.imza"; imza AUTH_SECRET ile (Web Crypto: middleware'de de çalışır).
 * Çerez yoksa ya da geçersizse oturum yönetici yetkisi taşımaz (bkz. auth.ts session callback, middleware).
 */

export const ADMIN_MFA_COOKIE = "admin_mfa";
export const ADMIN_MFA_MAX_AGE = 30 * 24 * 60 * 60; // 30 gün (oturum süresiyle aynı)

/** Acil durum anahtarı: telefon ve yedek kodlar kaybolursa Coolify'da ADMIN_2FA_DISABLED=1 verilip yeniden başlatılır */
export function isAdminMfaDisabled(): boolean {
    return process.env.ADMIN_2FA_DISABLED === "1" || process.env.ADMIN_2FA_DISABLED === "true";
}

const enc = new TextEncoder();

async function hmac(data: string): Promise<string> {
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
    const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
    return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signAdminMfaCookie(userId: string): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + ADMIN_MFA_MAX_AGE;
    const payload = `${userId}.${exp}`;
    return `${payload}.${await hmac(payload)}`;
}

/** Çerez bu kullanıcıya ait, süresi geçmemiş ve imzası doğru mu */
export async function verifyAdminMfaCookie(value: string | undefined | null, userId: string | undefined | null): Promise<boolean> {
    if (!value || !userId) return false;
    const parts = value.split(".");
    if (parts.length !== 3) return false;
    const [uid, expStr, sig] = parts;
    if (uid !== userId) return false;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
    const expected = await hmac(`${uid}.${expStr}`);
    if (expected.length !== sig.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    return diff === 0;
}

/**
 * Kurulum bitiş belgesi (15 dk): kod doğrulanınca verilir, yedek kodlar gösterildikten sonra çerezle değiştirilir.
 * Çerez doğrulama anında verilseydi Next.js sayfayı yenileyip yedek kodlar görünmeden panele geçiriyordu.
 */
export async function signSetupToken(userId: string): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + 15 * 60;
    const payload = `setup:${userId}.${exp}`;
    return `${userId}.${exp}.${await hmac(payload)}`;
}

export async function verifySetupToken(token: string, userId: string): Promise<boolean> {
    const parts = (token || "").split(".");
    if (parts.length !== 3) return false;
    const [uid, expStr, sig] = parts;
    if (uid !== userId || !(Number(expStr) > Date.now() / 1000)) return false;
    const expected = await hmac(`setup:${uid}.${expStr}`);
    if (expected.length !== sig.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    return diff === 0;
}
