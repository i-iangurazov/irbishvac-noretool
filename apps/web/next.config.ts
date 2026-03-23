import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@irbis/ui"],
  typedRoutes: true
};

export default nextConfig;
