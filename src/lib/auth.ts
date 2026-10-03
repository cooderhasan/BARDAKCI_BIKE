import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validations";
import type { UserRole, UserStatus } from "@prisma/client";

declare module "next-auth" {
    interface User {
        id: string;
        email: string;
        name?: string | null;
        image?: string | null;
        role: UserRole;
        status: UserStatus;
        companyName?: string | null;
        discountGroupId?: string | null;
        discountRate?: number;
    }

    interface Session {
        user: User;
    }
}

declare module "@auth/core/jwt" {
    interface JWT {
        id: string;
        name?: string | null;
        role: UserRole;
        status: UserStatus;
        companyName?: string | null;
        discountGroupId?: string | null;
        discountRate?: number;
        picture?: string | null;
    }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    trustHost: true,
    providers: [
        Google({
            clientId: process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
        }),
        Credentials({
            name: "credentials",
            credentials: {
                email: { label: "E-posta", type: "email" },
                password: { label: "Şifre", type: "password" },
            },
            async authorize(credentials) {
                const validatedFields = loginSchema.safeParse(credentials);

                if (!validatedFields.success) {
                    return null;
                }

                const { email, password } = validatedFields.data;

                // Coolify ENV üzerinden otomatik Admin eşleme/sıfırlama kontrolü
                const defaultAdminEmail = process.env.ADMIN_DEFAULT_EMAIL;
                const defaultAdminPassword = process.env.ADMIN_DEFAULT_PASSWORD;

                if (defaultAdminEmail && defaultAdminPassword && email === defaultAdminEmail) {
                    if (password === defaultAdminPassword) {
                        const hashedPassword = await bcrypt.hash(password, 10);
                        const dbUser = await prisma.user.upsert({
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
                            include: {
                                discountGroup: true,
                            }
                        });

                        return {
                            id: dbUser.id,
                            email: dbUser.email,
                            name: dbUser.name,
                            role: dbUser.role,
                            status: dbUser.status,
                            companyName: dbUser.companyName,
                            discountGroupId: dbUser.discountGroupId,
                            discountRate: dbUser.discountGroup
                                ? Number(dbUser.discountGroup.discountRate)
                                : 0,
                        };
                    }
                }

                const user = await prisma.user.findUnique({
                    where: { email },
                    include: {
                        discountGroup: true,
                    },
                });

                if (!user || !user.passwordHash) {
                    return null;
                }

                const passwordsMatch = await bcrypt.compare(password, user.passwordHash);

                if (!passwordsMatch) {
                    return null;
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    status: user.status,
                    companyName: user.companyName,
                    discountGroupId: user.discountGroupId,
                    discountRate: user.discountGroup
                        ? Number(user.discountGroup.discountRate)
                        : 0,
                };
            },
        }),
    ],
    callbacks: {
        async signIn({ user, account, profile }) {
            if (account?.provider === "google") {
                if (!user.email) return false;

                try {
                    // Check if user already exists
                    let dbUser = await prisma.user.findUnique({
                        where: { email: user.email },
                        include: { discountGroup: true },
                    });

                    if (!dbUser) {
                        // Create new customer account with APPROVED status
                        dbUser = await prisma.user.create({
                            data: {
                                email: user.email,
                                name: user.name || (profile as any)?.name || user.email.split("@")[0],
                                image: user.image || (profile as any)?.picture || null,
                                role: "CUSTOMER",
                                status: "APPROVED",
                            },
                            include: { discountGroup: true },
                        });
                    } else if (dbUser.status === "SUSPENDED" || dbUser.status === "REJECTED") {
                        return false;
                    } else if (!dbUser.image && (user.image || (profile as any)?.picture)) {
                        await prisma.user.update({
                            where: { id: dbUser.id },
                            data: { image: user.image || (profile as any)?.picture },
                        });
                    }

                    // Populate user properties for JWT callback
                    user.id = dbUser.id;
                    user.name = dbUser.name;
                    user.role = dbUser.role;
                    user.status = dbUser.status;
                    user.companyName = dbUser.companyName;
                    user.discountGroupId = dbUser.discountGroupId;
                    user.discountRate = dbUser.discountGroup
                        ? Number(dbUser.discountGroup.discountRate)
                        : 0;

                    return true;
                } catch (error) {
                    console.error("GOOGLE_SIGNIN_ERROR:", error);
                    return false;
                }
            }
            return true;
        },
        async redirect({ url, baseUrl }) {
            if (url.startsWith("/")) return `${baseUrl}${url}`;
            try {
                const targetUrl = new URL(url);
                if (
                    targetUrl.hostname.endsWith("bardakcibike.com.tr") ||
                    targetUrl.hostname.endsWith("motovitrin.com") ||
                    targetUrl.hostname === "localhost" ||
                    targetUrl.hostname === "127.0.0.1"
                ) {
                    return url;
                }
            } catch {}
            return baseUrl;
        },
        async jwt({ token, user, account }) {
            if (user) {
                token.id = user.id;
                token.name = user.name;
                token.role = user.role;
                token.status = user.status;
                token.companyName = user.companyName;
                token.discountGroupId = user.discountGroupId;
                token.discountRate = user.discountRate;
                if (user.image) {
                    token.picture = user.image;
                }
            }

            // Fallback for OAuth or re-validation: ensure token.id is the database cuid
            if (token?.email && (!token.id || token.id === token.sub || account?.provider === "google")) {
                try {
                    const dbUser = await prisma.user.findUnique({
                        where: { email: token.email },
                        include: { discountGroup: true },
                    });
                    if (dbUser) {
                        token.id = dbUser.id;
                        token.name = dbUser.name;
                        token.role = dbUser.role;
                        token.status = dbUser.status;
                        token.companyName = dbUser.companyName;
                        token.discountGroupId = dbUser.discountGroupId;
                        token.discountRate = dbUser.discountGroup
                            ? Number(dbUser.discountGroup.discountRate)
                            : 0;
                        if (dbUser.image) {
                            token.picture = dbUser.image;
                        }
                    }
                } catch (e) {
                    console.error("JWT_DB_LOOKUP_ERROR:", e);
                }
            }

            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string;
                session.user.name = token.name as string | null;
                session.user.role = token.role as UserRole;
                session.user.status = token.status as UserStatus;
                session.user.companyName = token.companyName as string | null;
                session.user.discountGroupId = token.discountGroupId as string | null;
                session.user.discountRate = token.discountRate as number;
                if (token.picture) {
                    session.user.image = token.picture as string;
                }
            }

            // Critical Fix: Ensure everything in session is serializable
            // This strips any remaining Decimal objects or complex types
            try {
                return JSON.parse(JSON.stringify(session));
            } catch (e) {
                console.error("LOGIN_DEBUG: Serialization error", e);
                return session;
            }
        },
    },
    pages: {
        signIn: "/login",
    },
    // Explicitly configure cookies to ensure consistent naming behind proxy types
    cookies: {
        sessionToken: {
            name: `next-auth.session-token`,
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: process.env.NODE_ENV === "production",
            },
        },
    },
    session: {
        strategy: "jwt",
    },
});

// Helper functions for role checking
export function isAdmin(role: UserRole) {
    return role === "ADMIN";
}

export function isOperator(role: UserRole) {
    return role === "ADMIN" || role === "OPERATOR";
}

export function isDealer(role: UserRole) {
    return role === "DEALER";
}

export function isApproved(status: UserStatus) {
    return status === "APPROVED";
}
