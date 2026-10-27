"use client";

import { useRef, useState } from "react";
import type { TaskStart, TaskState } from "./tasks";
import { checkAiTask } from "./actions";

const POLL_MS = 2500;
const GIVE_UP_MS = 5 * 60_000;

// Runs one small AI task: start it, then ask every few seconds until it is done (each check is short).
export function useAiTask<T>(lang: string, errors: Record<string, string>) {
  const [state, setState] = useState<"idle" | "working" | "done" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const message = (key: string, detail?: string) => `${errors[key] ?? errors.unexpected}${detail ? `: ${detail}` : ""}`;

  async function run(start: () => Promise<TaskStart>): Promise<T | null> {
    if (busy.current) return null;
    busy.current = true;
    setState("working");
    setError(null);
    try {
      const started = await start().catch((): TaskStart => ({ ok: false, error: "unexpected" }));
      if (!started.ok) {
        setState("failed");
        setError(message(started.error, started.message));
        return null;
      }
      const t0 = Date.now();
      while (Date.now() - t0 < GIVE_UP_MS) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const r = await checkAiTask(lang, started.taskId).catch((): TaskState => ({ state: "pending" }));
        if (r.state === "done") {
          setState("done");
          return r.result as T;
        }
        if (r.state === "failed") {
          setState("failed");
          setError(message(r.error, r.message));
          return null;
        }
      }
      setState("failed");
      setError(message("aiFailed"));
      return null;
    } finally {
      busy.current = false;
    }
  }
  return { state, error, run, working: state === "working" };
}
