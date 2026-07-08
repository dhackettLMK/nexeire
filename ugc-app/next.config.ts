import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  outputFileTracingIncludes: {
    "/app/**/*": ["./.remotion/bundle/**/*"],
    "/api/**/*": ["./.remotion/bundle/**/*"],
  },
  serverExternalPackages: [
    "@remotion/renderer",
    "@remotion/vercel",
    "@vercel/sandbox",
    "esbuild",
  ],
};

export default nextConfig;
