import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Authenticated demo pages always read fresh, per-request data (FR15).
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
