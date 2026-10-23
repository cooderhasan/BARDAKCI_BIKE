"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { verifyTotp, generateBackupCodes, hashBackupCode } from "@/lib/totp";

/** Yeni yedek kodlar: Authenticator'daki güncel kod istenir; eski yedek kodların hepsi geçersiz olur */
export async function regenerateBackupCodes(code: string): Promise<{ success: boolean; message?: string; backupCodes?: string[] }> {
    await requireAdmin();
    const session = await auth();
    const user = await prisma.user.findUnique({
        where: { id: session!.user.id },
        select: { id: true, twoFactorEnabled: true, twoFactorSecret: true, twoFactorLastStep: true },
    });
    if (!user?.twoFactorEnabled || !user.twoFactorSecret) return { success: false, message: "İki adımlı doğrulama açık değil." };

    const step = verifyTotp(user.twoFactorSecret, code, user.twoFactorLastStep);
    if (step == null) return { success: false, message: "Kod hatalı. Authenticator'daki güncel 6 haneli kodu girin." };

    const backupCodes = generateBackupCodes();
    await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorLastStep: step, twoFactorBackupCodes: backupCodes.map(hashBackupCode) },
    });
    return { success: true, backupCodes };
}

/** Kalan yedek kod sayısı */
export async function getBackupCodeCount(): Promise<number> {
    await requireAdmin();
    const session = await auth();
    const user = await prisma.user.findUnique({ where: { id: session!.user.id }, select: { twoFactorBackupCodes: true } });
    return user?.twoFactorBackupCodes.length ?? 0;
}
