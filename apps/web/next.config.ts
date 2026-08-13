import type { NextConfig } from "next";

const assetOrigin = new URL(
  process.env.R2_PUBLIC_BASE_URL ??
    "https://pub-bfeabc6c0e51459b9089454c6e741a39.r2.dev",
);

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: assetOrigin.protocol === "http:" ? "http" : "https",
        hostname: assetOrigin.hostname,
        port: assetOrigin.port,
        pathname: "/**",
      },
    ],
  },
  transpilePackages: ["@irbis/ui"],
  typedRoutes: true
};

export default nextConfig;
