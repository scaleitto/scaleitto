"use client";

import { useEffect } from "react";

const EVERY_MS = 60_000;
const IDLE_AFTER_MS = 5 * 60_000;

// Tells the server the member is working: once a minute, only while this tab is visible
// and the mouse or keyboard was used in the last 5 minutes.
export function ActivityPing() {
  useEffect(() => {
    let lastInput = Date.now();
    const onInput = () => {
      lastInput = Date.now();
    };
    const events = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart"] as const;
    for (const e of events) window.addEventListener(e, onInput, { passive: true });
    const ping = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastInput > IDLE_AFTER_MS) return;
      fetch("/api/activity", { method: "POST", keepalive: true }).catch(() => {});
    };
    ping();
    const timer = window.setInterval(ping, EVERY_MS);
    return () => {
      window.clearInterval(timer);
      for (const e of events) window.removeEventListener(e, onInput);
    };
  }, []);
  return null;
}
