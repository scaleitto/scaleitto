import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for cPanel / VPS hosting (see DEPLOYMENT.md)
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Kept as a real package in the standalone bundle so scripts/migrate.mjs can use it
  serverExternalPackages: ["mysql2"],
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
