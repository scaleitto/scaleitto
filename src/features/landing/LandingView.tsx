"use client";

import { useEffect } from "react";

// Counts one visit per page and browser session (not every reload).
export function LandingView({ pageId }: { pageId: string }) {
  useEffect(() => {
    const key = `lp-view-${pageId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // private mode: count anyway
    }
    fetch("/api/lp/view", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: pageId }), keepalive: true }).catch(() => {});
  }, [pageId]);
  return null;
}
