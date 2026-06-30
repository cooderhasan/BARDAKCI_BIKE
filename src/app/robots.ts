import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.bardakcibike.com.tr";

    return {
        rules: {
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
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
