"use server";

import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyTotp, generateBackupCodes, hashBackupCode } from "@/lib/totp";
import { ADMIN_MFA_COOKIE, ADMIN_MFA_MAX_AGE, signAdminMfaCookie, signSetupToken, verifySetupToken } from "@/lib/admin-mfa-cookie";

// Kod tahmini engeli: kullanıcı başına 10 dakikada en fazla 5 yanlış deneme (tek sunucu, bellekte)
const failures = new Map<string, { count: number; since: number }>();
const MAX_FAILS = 5;
const WINDOW_MS = 10 * 60 * 1000;

function tooManyFails(userId: string): boolean {
    const f = failures.get(userId);
    if (!f) return false;
    if (Date.now() - f.since > WINDOW_MS) {
        failures.delete(userId);
        return false;
    }
    return f.count >= MAX_FAILS;
}

function recordFail(userId: string) {
    const f = failures.get(userId);
    if (!f || Date.now() - f.since > WINDOW_MS) failures.set(userId, { count: 1, since: Date.now() });
    else f.count++;
}

/** Oturumdaki kullanıcı (oturum, kod girilene kadar yönetici yetkisi taşımadığı için rol veritabanından okunur) */
async function currentPanelUser() {
    const session = await auth();
    const id = session?.user?.id;
    if (!id) return null;
    const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true, twoFactorSecret: true, twoFactorEnabled: true, twoFactorBackupCodes: true, twoFactorLastStep: true },
    });
    if (!user || (user.role !== "ADMIN" && user.role !== "OPERATOR")) return null;
    return user;
}

async function grantCookie(userId: string) {
    (await cookies()).set(ADMIN_MFA_COOKIE, await signAdminMfaCookie(userId), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: ADMIN_MFA_MAX_AGE,
    });
}

/** İlk kurulum: QR okutulduktan sonra uygulamadaki kod girilir; doğruysa açılır ve yedek kodlar bir kez gösterilir */
export async function confirmTwoFactorSetup(code: string): Promise<{ success: boolean; message?: string; backupCodes?: string[]; setupToken?: string }> {
    const user = await currentPanelUser();
    if (!user) return { success: false, message: "Oturum bulunamadı, tekrar giriş yapın." };
    if (user.twoFactorEnabled) return { success: false, message: "İki adımlı doğrulama zaten açık." };
    if (!user.twoFactorSecret) return { success: false, message: "Kurulum anahtarı bulunamadı, sayfayı yenileyin." };
    if (tooManyFails(user.id)) return { success: false, message: "Çok fazla hatalı deneme. 10 dakika sonra tekrar deneyin." };

    const step = verifyTotp(user.twoFactorSecret, code, user.twoFactorLastStep);
    if (step == null) {
        recordFail(user.id);
        return { success: false, message: "Kod hatalı. Uygulamadaki güncel 6 haneli kodu girin (telefon saati otomatik olmalı)." };
    }

    const backupCodes = generateBackupCodes();
    await prisma.user.update({
        where: { id: user.id },
        data: {
            twoFactorEnabled: true,
            twoFactorLastStep: step,
            twoFactorBackupCodes: backupCodes.map(hashBackupCode),
        },
    });
    failures.delete(user.id);
    // Çerez burada verilmez (sayfa yenilenip yedek kodlar görünmeden panele geçiyordu); kodlar gösterildikten sonra
    // finishTwoFactorSetup ile bu belge karşılığında verilir
    return { success: true, backupCodes, setupToken: await signSetupToken(user.id) };
}

/** Kurulum sonu: yedek kodlar gösterildi, "panele geç" denince doğrulama çerezi verilir */
export async function finishTwoFactorSetup(setupToken: string): Promise<{ success: boolean; message?: string }> {
    const user = await currentPanelUser();
    if (!user || !user.twoFactorEnabled) return { success: false, message: "Oturum bulunamadı, tekrar giriş yapın." };
    if (!(await verifySetupToken(setupToken, user.id))) return { success: false, message: "Süre doldu, kodla giriş yapın." };
    await grantCookie(user.id);
    return { success: true };
}

/** Girişte kod (ya da yedek kod) doğrulama */
export async function verifyTwoFactorLogin(code: string, useBackup: boolean): Promise<{ success: boolean; message?: string }> {
    const user = await currentPanelUser();
    if (!user) return { success: false, message: "Oturum bulunamadı, tekrar giriş yapın." };
    if (!user.twoFactorEnabled || !user.twoFactorSecret) return { success: false, message: "Önce kurulumu tamamlayın, sayfayı yenileyin." };
    if (tooManyFails(user.id)) return { success: false, message: "Çok fazla hatalı deneme. 10 dakika sonra tekrar deneyin." };

    if (useBackup) {
        const h = hashBackupCode(code);
        if (!user.twoFactorBackupCodes.includes(h)) {
            recordFail(user.id);
            return { success: false, message: "Yedek kod hatalı ya da daha önce kullanılmış." };
        }
        // Yedek kod tek kullanımlık: kullanılınca silinir
        await prisma.user.update({
            where: { id: user.id },
            data: { twoFactorBackupCodes: user.twoFactorBackupCodes.filter((x) => x !== h) },
        });
    } else {
        const step = verifyTotp(user.twoFactorSecret, code, user.twoFactorLastStep);
        if (step == null) {
            recordFail(user.id);
            return { success: false, message: "Kod hatalı. Uygulamadaki güncel 6 haneli kodu girin." };
        }
        await prisma.user.update({ where: { id: user.id }, data: { twoFactorLastStep: step } });
    }

    failures.delete(user.id);
    await grantCookie(user.id);
    return { success: true };
}

/** Doğrulama ekranından çıkış (yanlış hesap ya da telefon yanında değil) */
export async function signOutFromTwoFactor() {
    const { signOut } = await import("@/lib/auth");
    (await cookies()).delete(ADMIN_MFA_COOKIE);
    await signOut({ redirectTo: "/admin/login" });
}
