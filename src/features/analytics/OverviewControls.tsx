"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Eye, EyeOff } from "lucide-react";

const KEY = "sc_hide_amounts";
const listeners = new Set<() => void>();
const read = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

// The eye on the overview: hides the amounts (blurred) for screen sharing; remembered in this browser
export function HideAmounts({ show, hide }: { show: string; hide: string }) {
  const hidden = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => false,
  );
  useEffect(() => {
    document.documentElement.toggleAttribute("data-hide-amounts", hidden);
    return () => document.documentElement.removeAttribute("data-hide-amounts");
  }, [hidden]);
  return (
    <button
      type="button"
      onClick={() => {
        try {
          localStorage.setItem(KEY, hidden ? "0" : "1");
        } catch {
          // private mode: only for this page
        }
        listeners.forEach((cb) => cb());
      }}
      className="grid size-10 place-items-center rounded-full bg-panel/80 text-muted shadow-sm ring-1 ring-line hover:text-fg"
      aria-label={hidden ? show : hide}
      title={hidden ? show : hide}
      aria-pressed={hidden}
      data-testid="hide-amounts"
    >
      {hidden ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  );
}
