import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Simple in-memory rate limiter
const rateLimitMap = new Map();

export async function middleware(request: NextRequest) {
    // 1. RATE LIMITING PROTECTION (DoS Prevention)
    // Basic protection: 100 requests per minute per IP
    const ip = request.headers.get("x-forwarded-for") || (request as any).ip || "unknown";

    // Rate limit configuration
    // Default: 1000 requests per minute (Generous limit for customers)
    // Admin: 5000 requests per minute (Effectively unlimited for admins)
    const isDashboard = request.nextUrl.pathname.startsWith("/admin");
    const limit = isDashboard ? 5000 : 1000;
    const windowMs = 60 * 1000; // 1 minute

    if (ip !== "unknown" && process.env.NODE_ENV === "production") {
        const now = Date.now();
        const clientData = rateLimitMap.get(ip);

        if (clientData) {
            if (now - clientData.startTime > windowMs) {
                // Reset window
                rateLimitMap.set(ip, { count: 1, startTime: now });
            } else {
                clientData.count++;
                if (clientData.count > limit) {
                    console.warn(`RATE_LIMIT_EXCEEDED: IP ${ip} blocked.`);
                    return new NextResponse("Too Many Requests (Rate Limit Exceeded)", { status: 429 });
                }
            }
        } else {
            rateLimitMap.set(ip, { count: 1, startTime: now });
        }

        // Cleanup old entries periodically (every 1000 requests roughly) to prevent memory leak
        if (rateLimitMap.size > 5000) {
            rateLimitMap.clear(); // Brute force cleanup for safety
        }
    }

    const { pathname } = request.nextUrl;

    // 1.5. OLD URL SMART FALLBACK (Redirect to Search)
    const fileName = pathname.split('/').pop() || "";
    // Sadece .html ile biten veya hiç uzantısı olmayan (nokta içermeyen) yolları işle
    const isOldFormat = fileName.endsWith(".html") || !fileName.includes(".");
    const isOldPrestashopUrl = isOldFormat && (/^\/[0-9]+-/.test(pathname) || /^\/[\w-]+\/[0-9]+-/.test(pathname));
    const isExcludedPath = pathname.startsWith('/admin') || 
                           pathname.startsWith('/api') || 
                           pathname.startsWith('/_next') || 
                           pathname.startsWith('/images') || 
                           pathname.startsWith('/uploads') ||
                           pathname.startsWith('/category') ||
                           pathname.startsWith('/products');

    if (isOldPrestashopUrl && !isExcludedPath) {
        let searchPhrase = fileName.replace(/\.html$/, '');
        // Remove leading IDs (e.g. 472-motosiklet -> motosiklet)
        searchPhrase = searchPhrase.replace(/^[0-9]+-/, '');
        // Replace dashes with spaces
        searchPhrase = searchPhrase.replace(/-/g, ' ');

        const searchUrl = new URL(`/products`, request.url);
        searchUrl.searchParams.set("search", searchPhrase);
        return NextResponse.redirect(searchUrl, 302); // 302 temporary is better for search redirects
    }

    // 2. AUTHENTICATION & SECURITY HEADERS
    const token = await getToken({
        req: request,
        secret: process.env.AUTH_SECRET,
        cookieName: "next-auth.session-token", // Explicitly match the name defined in auth.ts
        secureCookie: process.env.NODE_ENV === "production",
    });

    // Admin routes - require ADMIN or OPERATOR role
    if (pathname.startsWith("/admin")) {
        console.log("MW_DEBUG: Path:", pathname, "Token:", !!token, "Role:", token?.role);

        // Allow access to login page for everyone, but redirect logged-in admins to dashboard
        if (pathname === "/admin/login") {
            if (token && (token.role === "ADMIN" || token.role === "OPERATOR")) {
                return NextResponse.redirect(new URL("/admin", request.url));
            }
            return NextResponse.next();
        }

        if (!token) {
            return NextResponse.redirect(new URL("/admin/login", request.url));
        }
        if (token.role !== "ADMIN" && token.role !== "OPERATOR") {
            return NextResponse.redirect(new URL("/", request.url));
        }
    }

    const response = NextResponse.next();

    // Security Headers
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");

    // HSTS (Strict-Transport-Security) - Enabled in Production
    if (process.env.NODE_ENV === "production") {
        response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!_next/static|_next/image|favicon.ico|public).*)',
    ],
};
