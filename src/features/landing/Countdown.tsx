"use client";

import { useEffect, useState } from "react";
import type { StoreText } from "@/i18n/store";

// Counts down to the real end date chosen by the merchant (never restarts for each visitor).
export function Countdown({ endsAt, t }: { endsAt: string; t: StoreText["landing"] }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);
  const left = now === null ? null : Math.max(0, Date.parse(endsAt) - now);
  if (left === 0) return <p className="text-lg font-bold">{t.ended}</p>;
  const parts = left === null ? null : { d: Math.floor(left / 86400000), h: Math.floor(left / 3600000) % 24, m: Math.floor(left / 60000) % 60, s: Math.floor(left / 1000) % 60 };
  return (
    <div className="flex justify-center gap-2" dir="ltr">
      {(["d", "h", "m", "s"] as const).map((k) => (
        <div key={k} className="min-w-16 rounded-[var(--s-radius-btn)] bg-white/15 px-2 py-2 text-center">
          <div className="text-2xl font-extrabold tabular-nums">{parts ? String(parts[k]).padStart(2, "0") : "--"}</div>
          <div className="text-xs opacity-80">{t.units[k]}</div>
        </div>
      ))}
    </div>
  );
}
