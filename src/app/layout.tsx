import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  themeColor: "#17457C",
  width: "device-width",
  initialScale: 1,
};

import { getStoreType, getStoreSettings } from "@/lib/store-helper";

export async function generateMetadata(): Promise<Metadata> {
  let general: any = {};
  let storeTitle = "Bardakcı Bike";
  let faviconUrl = "/favicon.ico";

  try {
    const generalSettings = await prisma.siteSettings.findUnique({
      where: { key: "general" },
    });
    general = (generalSettings?.value as any) || {};

    const activeStore = await getStoreType();
    const storeSettings = await getStoreSettings(activeStore);
    storeTitle = storeSettings.siteTitle;
    if (storeSettings.faviconUrl) {
      faviconUrl = storeSettings.faviconUrl;
    } else if (general.faviconUrl) {
      faviconUrl = general.faviconUrl;
    }
  } catch (error) {
    console.warn("Could not fetch site settings for metadata, using defaults.", error);
  }

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.bardakcibike.com.tr";

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: storeTitle,
      template: `%s | ${storeTitle}`,
    },
    description: general.seoDescription || "Toptan ve Perakende Satış Platformu",
    keywords: general.seoKeywords?.split(",") || [],
    icons: {
      icon: [
        {
          url: faviconUrl,
          sizes: "32x32",
          type: faviconUrl.endsWith(".png") ? "image/png" : "image/x-icon",
        },
        {
          url: faviconUrl,
          sizes: "16x16",
          type: faviconUrl.endsWith(".png") ? "image/png" : "image/x-icon",
        },
      ],
      shortcut: {
        url: faviconUrl,
        type: faviconUrl.endsWith(".png") ? "image/png" : "image/x-icon",
      },
      apple: general.appleTouchIconUrl || faviconUrl || "/apple-touch-icon.png",
      other: [
        {
          rel: "icon",
          url: faviconUrl,
        },
      ],
    },
    openGraph: {
      title: general.seoTitle || storeTitle,
      description: general.seoDescription || "Toptan ve Perakende Satış Platformu",
      siteName: storeTitle,
      images: [
        {
          url: general.ogImageUrl 
            ? (general.ogImageUrl.startsWith("http") ? general.ogImageUrl : `${siteUrl}${general.ogImageUrl}`)
            : `${siteUrl}/img/og-default.jpg`,
          width: 1200,
          height: 630,
          alt: storeTitle,
        }
      ],
      locale: "tr_TR",
      type: "website",
    },
    alternates: {
      canonical: "./",
      languages: {
        "tr-TR": "./",
        "x-default": "./",
      },
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
