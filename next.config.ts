import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.NEXT_DEV_DIST_DIR ? { distDir: process.env.NEXT_DEV_DIST_DIR } : {}),
};

export default nextConfig;
