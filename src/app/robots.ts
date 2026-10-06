import { MetadataRoute } from "next";
import { headers } from "next/headers";

export default async function robots(): Promise<MetadataRoute.Robots> {
    const headersList = await headers();
    const host = headersList.get("host") || "www.bardakcibike.com.tr";
    const baseUrl = `https://${host}`;

    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: [
                    "/admin/", 
                    "/api/", 
                    "/profile/",
                    "/cart",
                    "/checkout",
                    "/payment",
                    "/orders",
                    "/account",
                    "/quick-order",
                    "/forgot-password",
                    "/reset-password",
                    "/login",
                    "/register"
                ],
            },
            {
                userAgent: [
                    "GPTBot",
                    "ChatGPT-User",
                    "PerplexityBot",
                    "ClaudeBot",
                    "anthropic-ai",
                    "Google-Extended",
                    "GoogleOther",
                    "Applebot-Extended",
                    "cohere-ai",
                    "OAI-SearchBot"
                ],
                allow: [
                    "/",
                    "/llms.txt",
                    "/llms-full.txt"
                ],
                disallow: [
                    "/admin/", 
                    "/api/", 
                    "/profile/",
                    "/cart",
                    "/checkout",
                    "/payment",
                    "/orders",
                    "/account"
                ],
            }
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
