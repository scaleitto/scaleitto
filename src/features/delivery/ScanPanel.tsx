"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, CameraOff, CircleCheck, CircleX, ScanLine } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt } from "@/lib/format";
import { Button, inputClass } from "@/ui";
import { scanParcel } from "./actions";

type Mode = "dispatch" | "recuperate";
type Result = { key: number; code: string; ok: boolean; text: string };
type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorClass = new (options?: { formats: string[] }) => Detector;

let keys = 0;

// Scan parcels: a hand scanner types the code and Enter in the box; phones and laptops can read it with the camera
// (the browser's BarcodeDetector, where it exists). Every scan is saved at once and listed with its result.
export function ScanPanel({ lang, t }: { lang: string; t: Dictionary["orderPage"] }) {
  const [mode, setMode] = useState<Mode>("dispatch");
  const [code, setCode] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [camera, setCamera] = useState<"off" | "on" | "missing">("off");
  const [pending, start] = useTransition();
  const video = useRef<HTMLVideoElement>(null);
  const last = useRef({ code: "", at: 0 });
  const errors = t.scanErrors as Record<string, string>;

  const scan = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    // The camera sees the same label many times a second: one scan per code every few seconds
    const now = Date.now();
    if (last.current.code === value && now - last.current.at < 4000) return;
    last.current = { code: value, at: now };
    start(async () => {
      const r = await scanParcel(lang, mode, value);
      const label = r.number ? `#${r.number}` : value;
      setResults((list) => [{ key: ++keys, code: label, ok: Boolean(r.ok), text: r.ok ? (mode === "dispatch" ? t.dispatch : t.recuperate) : (errors[r.error ?? ""] ?? errors.notFound) }, ...list].slice(0, 200));
    });
  };

  // The camera loop: started and stopped with the button, stopped when the page closes
  const scanRef = useRef(scan);
  useEffect(() => {
    scanRef.current = scan;
  });
  useEffect(() => {
    if (camera !== "on") return;
    const Barcode = (window as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
    let stream: MediaStream | null = null;
    let timer = 0;
    let live = true;
    (async () => {
      try {
        if (!Barcode || !navigator.mediaDevices) throw new Error("unsupported");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!live || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const detector = new Barcode({ formats: ["code_128", "code_39", "ean_13", "qr_code", "itf", "codabar"] });
        const tick = async () => {
          if (!live || !video.current) return;
          const found = await detector.detect(video.current).catch(() => []);
          if (found[0]?.rawValue) scanRef.current(found[0].rawValue);
          timer = window.setTimeout(tick, 350);
        };
        void tick();
      } catch {
        if (live) setCamera("missing");
      }
    })();
    return () => {
      live = false;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [camera]);

  const ok = results.filter((r) => r.ok).length;
  // Zimam's layout: a banner with the title and the mode switch, one large field with the camera button, then the results
  return (
    <div className="space-y-4">
      <h1 className="sr-only">{t.scanTitle}</h1>
      <section className="flex flex-wrap items-start gap-4 rounded-2xl border border-info/30 bg-info/5 p-4">
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ScanLine size={20} /> {t.scanTitle}
          </h2>
          <p className="text-sm text-muted">{t.scanHint}</p>
          <p className="text-sm font-semibold" data-testid="scan-mode-hint">
            {mode === "dispatch" ? t.dispatchHint : t.recuperateHint}
          </p>
        </div>
        <div className="flex rounded-xl bg-panel p-1 shadow-sm" role="tablist">
          {(["dispatch", "recuperate"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              data-mode={m}
              onClick={() => setMode(m)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${mode === m ? "bg-info text-white" : "text-muted hover:text-fg"}`}
            >
              {m === "dispatch" ? t.dispatch : t.recuperate}
            </button>
          ))}
        </div>
      </section>

      <form
        className="space-y-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          last.current = { code: "", at: 0 };
          scan(code);
          setCode("");
        }}
      >
        <div className="flex gap-2">
          <input
            id="scan-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t.codePlaceholder}
            dir="ltr"
            autoFocus
            autoComplete="off"
            className={`${inputClass} h-16 text-lg`}
            data-testid="scan-code"
          />
          <button type="submit" className="sr-only" disabled={pending || !code.trim()} data-testid="scan-submit">
            {t.scanBtn}
          </button>
          <Button type="button" variant="secondary" className="h-16 shrink-0" onClick={() => setCamera(camera === "on" ? "off" : "on")} data-testid="camera">
            {camera === "on" ? <CameraOff size={16} /> : <Camera size={16} />} {camera === "on" ? t.stopCamera : t.useCamera}
          </Button>
        </div>
        <label htmlFor="scan-code" className="block text-xs font-medium text-muted">
          {t.typeCode}
        </label>
      </form>

      {camera === "on" && <video ref={video} muted playsInline className="aspect-video w-full max-w-xl rounded-xl bg-black object-cover" />}
      {camera === "missing" && <p className="text-sm text-warning">{t.noCamera}</p>}

      <div className="space-y-3" data-testid="scan-results">
        <div className="flex gap-2 text-sm">
          <p className="rounded-lg bg-accent-soft px-3 py-1.5 font-semibold text-accent-ink" data-testid="scan-done">
            {fmt(t.done, { n: ok })}
          </p>
          <p className="rounded-lg bg-danger-soft px-3 py-1.5 font-semibold text-danger" data-testid="scan-failed">
            {fmt(t.failed, { n: results.length - ok })}
          </p>
        </div>
        {results.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line py-6 text-center text-sm text-muted">{t.nothingYet}</p>
        ) : (
          <ul className="space-y-2">
            {results.map((r) => (
              <li key={r.key} className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-sm" data-scan={r.ok ? "ok" : "failed"}>
                {r.ok ? <CircleCheck size={16} className="shrink-0 text-accent" /> : <CircleX size={16} className="shrink-0 text-danger" />}
                <span className="font-semibold tabular-nums" dir="ltr">
                  {r.code}
                </span>
                <span className="ms-auto text-xs text-muted">{r.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
