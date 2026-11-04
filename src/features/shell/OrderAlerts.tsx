"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { playSound, readPrefs } from "./alerts";

const EVERY_MS = 30_000;

// While the dashboard is open: every 30 seconds, asks for the newest order number; a higher one sounds the chosen alert
// and, when the browser allows it, shows a system notification that opens the orders.
export function OrderAlerts({ title, body, href, other }: { title: string; body: string; href: string; other?: string }) {
  const router = useRouter();
  useEffect(() => {
    let last: number | null = null;
    let lastLeft: number | null = null;
    let stopped = false;
    const check = async () => {
      try {
        const r = await fetch("/api/orders/latest", { cache: "no-store" });
        if (!r.ok) return;
        const { number, abandoned } = (await r.json()) as { number: number | null; abandoned?: number };
        if (stopped || number === null) return;
        if (last !== null && number > last) {
          const prefs = readPrefs();
          playSound(prefs.sound, prefs.volume);
          if ("Notification" in window && Notification.permission === "granted") {
            const n = new Notification(title.replace("{n}", String(number)), { body, tag: "new-order", icon: "/icon.svg" });
            n.onclick = () => {
              window.focus();
              router.push(href);
              n.close();
            };
          }
          window.dispatchEvent(new CustomEvent("sc:new-order", { detail: number }));
        }
        last = number;
        // Other notifications: a buyer left the checkout
        if (abandoned !== undefined) {
          if (lastLeft !== null && abandoned > lastLeft) {
            const prefs = readPrefs();
            playSound(prefs.other, prefs.volume);
            if (other && "Notification" in window && Notification.permission === "granted") new Notification(other, { tag: "abandoned", icon: "/icon.svg" });
          }
          lastLeft = abandoned;
        }
      } catch {
        // offline: try again later
      }
    };
    void check();
    const timer = window.setInterval(check, EVERY_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [title, body, href, other, router]);
  return null;
}
