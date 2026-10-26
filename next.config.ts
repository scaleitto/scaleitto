import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for cPanel / VPS hosting (see DEPLOYMENT.md)
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Shown in /api/health and the admin panel so it is easy to tell which version a server runs.
  env: {
    BUILD_COMMIT: (process.env.GITHUB_SHA ?? "local").slice(0, 7),
    BUILD_TIME: new Date().toISOString(),
  },
  // Kept as a real package in the standalone bundle so scripts/migrate.mjs can use it
  serverExternalPackages: ["mysql2", "sharp"],
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
