import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for cPanel / VPS hosting (see DEPLOYMENT.md)
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Sections moved under a parent section (round 7): old links keep working
  async redirects() {
    return [
      { source: "/:lang(ar|fr|en)/dashboard/pixels", destination: "/:lang/dashboard/integrations/pixels", permanent: true },
      { source: "/:lang(ar|fr|en)/dashboard/apps", destination: "/:lang/dashboard/integrations/apps", permanent: true },
      { source: "/:lang(ar|fr|en)/dashboard/themes", destination: "/:lang/dashboard/store-design/themes", permanent: true },
      { source: "/:lang(ar|fr|en)/dashboard/order-form", destination: "/:lang/dashboard/store-design/order-form", permanent: true },
      { source: "/:lang(ar|fr|en)/dashboard/orders/insights", destination: "/:lang/dashboard/analytics", permanent: true },
      // The orders sub-pages became status tabs (Zimam parity)
      { source: "/:lang(ar|fr|en)/dashboard/orders/shipping", destination: "/:lang/dashboard/orders?status=confirmed", permanent: true },
      { source: "/:lang(ar|fr|en)/dashboard/orders/tracking", destination: "/:lang/dashboard/orders?status=in_transit", permanent: true },
      { source: "/:lang(ar|fr|en)/dashboard/orders/returns", destination: "/:lang/dashboard/orders?status=returned", permanent: true },
      { source: "/:lang(ar|fr|en)/dashboard/orders/abandoned", destination: "/:lang/dashboard/orders?status=abandoned", permanent: true },
    ];
  },
  // Shown in /api/health and the admin panel so it is easy to tell which version a server runs.
  env: {
    BUILD_COMMIT: (process.env.GITHUB_SHA ?? "local").slice(0, 7),
    BUILD_TIME: new Date().toISOString(),
  },
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
