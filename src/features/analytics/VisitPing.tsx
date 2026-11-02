"use client";

import { useEffect } from "react";

// Counts one storefront page view for the merchant's analytics (impressions, visitors, traffic sources)
export function VisitPing({ shopId, productId }: { shopId: string; productId?: string | null }) {
  useEffect(() => {
    void fetch("/api/visit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shop: shopId, product: productId ?? undefined, ref: document.referrer }), keepalive: true }).catch(() => {});
  }, [shopId, productId]);
  return null;
}
