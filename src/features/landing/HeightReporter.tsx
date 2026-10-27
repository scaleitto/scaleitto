"use client";

import { useEffect } from "react";

// Inside an iframe: tells the host page our height so the frame never shows a scrollbar
// (the snippet given to merchants listens for this message).
export function HeightReporter({ frameId }: { frameId: string }) {
  useEffect(() => {
    if (window.parent === window) return;
    const send = () => window.parent.postMessage({ type: "scaleitto:height", id: frameId, height: document.documentElement.scrollHeight }, "*");
    const observer = new ResizeObserver(send);
    observer.observe(document.body);
    send();
    return () => observer.disconnect();
  }, [frameId]);
  return null;
}
