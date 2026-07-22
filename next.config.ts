import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Acceptance runs use a unique directory so a developer build and a critic
  // build cannot corrupt one another's manifests.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
