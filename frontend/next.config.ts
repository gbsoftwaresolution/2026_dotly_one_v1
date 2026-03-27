import type { NextConfig } from "next";

import { getFrontendSecurityHeaders } from "./src/lib/security/headers";

const outputFileTracingRoot = new URL("..", import.meta.url).pathname;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: getFrontendSecurityHeaders({
          nodeEnv: process.env.NODE_ENV,
        }),
      },
    ];
  },
};

export default nextConfig;
