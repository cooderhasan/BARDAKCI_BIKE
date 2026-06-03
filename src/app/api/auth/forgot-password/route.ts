import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import crypto from "crypto";

export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json();

        if (!email || typeof email !== "string") {
            return NextResponse.json(
                { error: "E-posta adresi gereklidir." },
                { status: 400 }
            );
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Find user - but don't reveal if they exist or not (security)
        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
        });

        // Rate limiting: check if a token was sent recently (within last 2 minutes)
        if (user) {
            const recentToken = await prisma.passwordResetToken.findFirst({
                where: {
                    email: normalizedEmail,
                    createdAt: {
                        gte: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
                    },
                },
            });

            if (recentToken) {
                // Still return success to not reveal information
                return NextResponse.json({
                    message: "Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.",
                });
            }
        }

        if (user) {
            // Generate a secure random token
            const token = crypto.randomBytes(32).toString("hex");
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

            // Invalidate any existing unused tokens for this email
            await prisma.passwordResetToken.updateMany({
                where: {
                    email: normalizedEmail,
                    usedAt: null,
                },
                data: {
                    usedAt: new Date(), // Mark as used
                },
            });

            // Create new token
            await prisma.passwordResetToken.create({
                data: {
                    email: normalizedEmail,
                    token,
                    expiresAt,
                },
            });

            // Build reset URL
            const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            const resetUrl = `${baseUrl}/reset-password?token=${token}`;

            // Send email
            await sendPasswordResetEmail({
                to: normalizedEmail,
                customerName: user.name || user.companyName || "Değerli Müşterimiz",
                resetUrl,
                expiresInMinutes: 60,
            });
        }

        // Always return success to prevent email enumeration
        return NextResponse.json({
            message: "Eğer bu e-posta adresi ile kayıtlı bir hesap varsa, şifre sıfırlama bağlantısı gönderildi.",
        });
    } catch (error) {
        console.error("Forgot password error:", error);
        return NextResponse.json(
            { error: "Bir hata oluştu. Lütfen tekrar deneyin." },
            { status: 500 }
        );
    }
}
