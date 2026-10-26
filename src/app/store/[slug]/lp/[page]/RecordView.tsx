"use client";

import { useEffect } from "react";

export function RecordView({ pageId, record }: { pageId: string; record: () => Promise<void> }) {
  useEffect(() => {
    const key = `sc_lp_view_${pageId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // storage unavailable: count this page load
    }
    record().catch(() => {});
  }, [pageId, record]);
  return null;
}
