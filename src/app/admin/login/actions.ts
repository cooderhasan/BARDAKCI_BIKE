"use server";

import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";

export async function authenticateAdmin(prevState: string | undefined, formData: FormData) {
    try {
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;

        // Coolify ENV üzerinden otomatik Admin eşleme/sıfırlama kontrolü
        const defaultAdminEmail = process.env.ADMIN_DEFAULT_EMAIL;
        const defaultAdminPassword = process.env.ADMIN_DEFAULT_PASSWORD;

        if (defaultAdminEmail && defaultAdminPassword && email === defaultAdminEmail) {
            if (password === defaultAdminPassword) {
                const hashedPassword = await bcrypt.hash(password, 10);
                await prisma.user.upsert({
                    where: { email: defaultAdminEmail },
                    update: {
                        passwordHash: hashedPassword,
                        role: "ADMIN",
                        status: "APPROVED",
                    },
                    create: {
                        email: defaultAdminEmail,
                        passwordHash: hashedPassword,
                        role: "ADMIN",
                        status: "APPROVED",
                        companyName: "B2B Admin",
                    },
                });
            }
        }

        // 1. Manually verify user and role before calling signIn
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return "Hatalı e-posta veya şifre.";
        }

        if (user.role !== "ADMIN" && user.role !== "OPERATOR") {
            return "Bu panele giriş yetkiniz bulunmamaktadır.";
        }

        // 2. Verify password manually to avoid double-logging if we used signIn directly and it failed
        // (Optional, but signIn handles it. Main thing is role check above).
        // Actually, we can just proceed to signIn now that we know the role is allowed *if* credentials are good.
        // However, if we just call signIn, NextAuth tries to login.
        // Let's rely on NextAuth for password check to keep it DRYer, or do it here.
        // Doing it here gives us better control over the specific "Role Denied" message vs "Invalid Credentials".

        const passwordsMatch = await bcrypt.compare(password, user.passwordHash || "");
        if (!passwordsMatch) {
            return "Hatalı e-posta veya şifre.";
        }

        // 3. Authenticate
        await signIn("credentials", {
            email,
            password,
            redirectTo: "/admin", // Force redirect to admin dashboard
        });

    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case "CredentialsSignin":
                    return "Giriş yapılamadı.";
                default:
                    return "Bir hata oluştu.";
            }
        }
        // NextJS redirects act as errors
        throw error;
    }
}
