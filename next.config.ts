import type { NextConfig } from "next";

const renderRouteIncludes = [
  "./node_modules/@esbuild/**/*",
  "./node_modules/@mediabunny/**/*",
  "./node_modules/@remotion/**/*",
  "./node_modules/@rspack/**/*",
  "./node_modules/mediabunny/**/*",
  "./node_modules/remotion/**/*",
  "./remotion/**/*",
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  serverExternalPackages: ["@remotion/bundler", "@remotion/renderer", "remotion"],
  outputFileTracingIncludes: {
    "/api/launch-packs/\\[id\\]/render": renderRouteIncludes,
    "/api/launch-packs/[id]/render": renderRouteIncludes,
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
