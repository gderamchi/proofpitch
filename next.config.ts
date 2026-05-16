import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  serverExternalPackages: ["@remotion/bundler", "@remotion/renderer", "remotion"],
  outputFileTracingIncludes: {
    "/api/launch-packs/\\[id\\]/render": [
      "./node_modules/@remotion/**/*",
      "./node_modules/remotion/**/*",
      "./remotion/**/*",
    ],
    "/api/launch-packs/[id]/render": [
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
