import crypto from "crypto";

/**
 * Google Authenticator uyumlu zaman bazlı tek kullanımlık kod (TOTP, RFC 6238): HMAC-SHA1, 6 hane, 30 sn.
 * Google'a bağlanmaz; telefon ve sunucu aynı gizli anahtar + saatle aynı kodu üretir.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;

function base32Encode(buf: Buffer): string {
    let bits = 0;
    let value = 0;
    let out = "";
    for (const byte of buf) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            out += ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
    return out;
}

function base32Decode(text: string): Buffer {
    const clean = text.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
    let bits = 0;
    let value = 0;
    const out: number[] = [];
    for (const ch of clean) {
        const idx = ALPHABET.indexOf(ch);
        if (idx < 0) continue;
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return Buffer.from(out);
}

export function generateTotpSecret(): string {
    return base32Encode(crypto.randomBytes(20));
}

function codeAt(secret: string, step: number): string {
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(step));
    const hmac = crypto.createHmac("sha1", base32Decode(secret)).update(counter).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const num = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
    return num.toString().padStart(6, "0");
}

/**
 * Kodu doğrular; telefon saatindeki küçük kaymalar için bir önceki/sonraki 30 sn de kabul edilir.
 * Eşleşen zaman adımını döner (aynı kodun tekrar kullanılmasını engellemek için saklanır), yoksa null.
 */
export function verifyTotp(secret: string, code: string, lastUsedStep?: number | null): number | null {
    const c = (code || "").replace(/\s+/g, "");
    if (!/^\d{6}$/.test(c)) return null;
    const now = Math.floor(Date.now() / 1000 / STEP_SECONDS);
    for (const step of [now, now - 1, now + 1]) {
        if (lastUsedStep != null && step <= lastUsedStep) continue;
        const expected = codeAt(secret, step);
        if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(c))) return step;
    }
    return null;
}

/** Authenticator uygulamasının okuyacağı adres (QR kodun içeriği) */
export function totpAuthUri(secret: string, account: string, issuer: string): string {
    const label = encodeURIComponent(`${issuer}:${account}`);
    return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
}

/** Tek kullanımlık yedek kodlar: "abcd-efgh" biçiminde; veritabanına özetleri yazılır */
export function generateBackupCodes(count = 8): string[] {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789"; // karışan harfler (l/1, o/0) yok
    return Array.from({ length: count }, () => {
        const bytes = crypto.randomBytes(8);
        const s = Array.from(bytes, (b) => chars[b % chars.length]).join("");
        return `${s.slice(0, 4)}-${s.slice(4)}`;
    });
}

export function hashBackupCode(code: string): string {
    const norm = (code || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return crypto.createHash("sha256").update(norm).digest("hex");
}
