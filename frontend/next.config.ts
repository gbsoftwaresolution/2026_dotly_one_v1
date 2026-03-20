import type { NextConfig } from "next";

const outputFileTracingRoot = new URL("..", import.meta.url).pathname;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot,
};

export default nextConfig;
