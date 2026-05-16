import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  outputFileTracingIncludes: {
    "/api/launch-packs/[id]/render": [
      "./node_modules/.bin/remotion",
      "./node_modules/@remotion/**/*",
      "./node_modules/remotion/**/*",
      "./remotion/**/*",
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
