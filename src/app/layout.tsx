import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers/session-provider";
import { GoogleAnalytics } from '@next/third-parties/google';
import Script from "next/script";

// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
// });

// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
// });

import { prisma } from "@/lib/db";

export async function generateMetadata(): Promise<Metadata> {
  let general: any = {};

  try {
    const generalSettings = await prisma.siteSettings.findUnique({
      where: { key: "general" },
    });
    general = (generalSettings?.value as any) || {};
  } catch (error) {
    // Fallback to default metadata if DB is not ready (e.g. during build)
    console.warn("Could not fetch site settings, using defaults.", error);
  }

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://www.bardakcibike.com.tr"),
    title: {
      default: general.seoTitle || general.siteName || "B2B E-Ticaret Platformu",
      template: `%s | ${general.siteName || "B2B"}`,
    },
    description: general.seoDescription || "B2B Toptan Satış Platformu",
    keywords: general.seoKeywords?.split(",") || [],
    icons: {
      icon: general.faviconUrl || "/favicon.ico",
      shortcut: general.faviconUrl || "/favicon.ico",
      apple: general.faviconUrl || "/favicon.ico", // Or a specific apple touch icon if available
    },
    openGraph: {
      title: general.seoTitle || general.siteName || "B2B E-Ticaret Platformu",
      description: general.seoDescription || "B2B Toptan Satış Platformu",
      siteName: general.siteName || "B2B",
    },
    alternates: {
      canonical: "./",
    },
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION || general.googleVerification || undefined,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let general: any = {};
  try {
    const generalSettings = await prisma.siteSettings.findUnique({
      where: { key: "general" },
    });
    general = (generalSettings?.value as any) || {};
  } catch (error) {
    console.warn("Could not fetch site settings for layout.", error);
  }

  return (
    <html lang="tr">
      <body className="antialiased">
        <Providers>
          {children}
          <Toaster position="top-center" richColors />
        </Providers>

        {/* Analytics & Tracking Scripts */}
        {general?.googleAnalyticsId && (
          <GoogleAnalytics gaId={general.googleAnalyticsId} />
        )}
        
        {general?.metaPixelId && (
          <Script id="meta-pixel" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${general.metaPixelId}');
              fbq('track', 'PageView');
            `}
          </Script>
        )}
        
        {general?.metaPixelId && (
          <noscript>
            <img 
              height="1" 
              width="1" 
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${general.metaPixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        )}

        {general?.customBodyScripts && (
          <div dangerouslySetInnerHTML={{ __html: general.customBodyScripts }} />
        )}
      </body>
    </html>
  );
}
