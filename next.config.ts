import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: false,
  serverExternalPackages: ['@react-pdf/renderer'],
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
    formats: ['image/webp'],
    minimumCacheTTL: 2592000,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  async redirects() {
    let customRedirects = [];
    try {
      const redirectsPath = path.join(process.cwd(), 'redirects.json');
      if (fs.existsSync(redirectsPath)) {
        customRedirects = JSON.parse(fs.readFileSync(redirectsPath, 'utf8'));
      }
    } catch (e) {
      console.warn("Could not load redirects.json", e);
    }

    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'bardakcibike.com.tr',
          },
        ],
        destination: 'https://www.bardakcibike.com.tr/:path*',
        permanent: true,
      },
      {
        source: '/urun/:path*',
        destination: '/products/:path*',
        permanent: true,
      },
      {
        source: '/kategori/:path*',
        destination: '/category/:path*',
        permanent: true,
      },
      ...customRedirects
    ];
  },
};

export default nextConfig;
