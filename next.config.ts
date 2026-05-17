import type { NextConfig } from "next";

const renderRouteIncludes = [
  "./node_modules/.bin/hyperframes",
  "./node_modules/@esbuild/**/*",
  "./node_modules/@hono/**/*",
  "./node_modules/@img/**/*",
  "./node_modules/@puppeteer/**/*",
  "./node_modules/hono/**/*",
  "./node_modules/hyperframes/**/*",
  "./node_modules/linkedom/**/*",
  "./node_modules/mime-types/**/*",
  "./node_modules/onnxruntime-node/**/*",
  "./node_modules/puppeteer-core/**/*",
  "./node_modules/sharp/**/*",
  "./node_modules/zod/**/*",
  "./hyperframes/**/*",
];
const renderRouteExcludes = [
  "./node_modules/lightningcss-linux-x64-musl/**/*",
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  serverExternalPackages: ["hyperframes", "onnxruntime-node", "sharp"],
  outputFileTracingIncludes: {
    "/api/launch-packs/\\[id\\]/render": renderRouteIncludes,
    "/api/launch-packs/[id]/render": renderRouteIncludes,
  },
  outputFileTracingExcludes: {
    "/api/launch-packs/\\[id\\]/render": renderRouteExcludes,
    "/api/launch-packs/[id]/render": renderRouteExcludes,
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
