import type { NextConfig } from "next";

const renderRouteIncludes = [
  "./node_modules/@esbuild/**/*",
  "./node_modules/@mediabunny/**/*",
  "./node_modules/@remotion/bundler/**/*",
  "./node_modules/@remotion/compositor-linux-x64-gnu/**/*",
  "./node_modules/@remotion/licensing/**/*",
  "./node_modules/@remotion/media-parser/**/*",
  "./node_modules/@remotion/media-utils/**/*",
  "./node_modules/@remotion/player/**/*",
  "./node_modules/@remotion/renderer/**/*",
  "./node_modules/@remotion/streaming/**/*",
  "./node_modules/@remotion/studio/**/*",
  "./node_modules/@remotion/studio-server/**/*",
  "./node_modules/@remotion/studio-shared/**/*",
  "./node_modules/@remotion/timeline-utils/**/*",
  "./node_modules/@remotion/web-renderer/**/*",
  "./node_modules/@remotion/zod-types/**/*",
  "./node_modules/@rspack/binding/**/*",
  "./node_modules/@rspack/binding-linux-x64-gnu/**/*",
  "./node_modules/mediabunny/**/*",
  "./node_modules/remotion/**/*",
  "./remotion/**/*",
];
const renderRouteExcludes = [
  "./node_modules/@remotion/compositor-linux-x64-musl/**/*",
  "./node_modules/@rspack/binding-linux-x64-musl/**/*",
  "./node_modules/lightningcss-linux-x64-musl/**/*",
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  serverExternalPackages: ["@remotion/bundler", "@remotion/renderer", "remotion"],
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
