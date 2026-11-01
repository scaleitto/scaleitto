"use client";

import { useEffect } from "react";

// Counts one visit per page and browser session (not every reload), for the version shown, and remembers that
// version so the visitor keeps seeing the same one.
export function LandingView({ pageId, version }: { pageId: string; version: string }) {
  useEffect(() => {
    try {
      document.cookie = `lpv_${pageId}=${version}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    } catch {
      // cookies blocked: the visitor may see another version next time
    }
    const key = `lp-view-${pageId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // private mode: count anyway
    }
    fetch("/api/lp/view", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: pageId, v: version }), keepalive: true }).catch(() => {});
  }, [pageId, version]);
  return null;
}
