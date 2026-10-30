"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, CameraOff, CircleCheck, CircleX, PackageCheck, ScanLine, Truck } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt } from "@/lib/format";
import { Button, Card, inputClass } from "@/ui";
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
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card className="space-y-5">
        <div className="grid grid-cols-2 gap-2" role="tablist">
          {(["dispatch", "recuperate"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              data-mode={m}
              onClick={() => setMode(m)}
              className={`flex items-center gap-3 rounded-xl border p-4 text-start transition-colors ${mode === m ? "border-accent bg-accent-soft" : "border-line hover:bg-panel-2"}`}
            >
              {m === "dispatch" ? <Truck size={20} className="text-accent" /> : <PackageCheck size={20} className="text-accent" />}
              <span>
                <span className="block font-semibold">{m === "dispatch" ? t.dispatch : t.recuperate}</span>
                <span className="block text-xs text-muted">{m === "dispatch" ? t.dispatchHint : t.recuperateHint}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-dashed border-line bg-panel-2">
          {camera === "on" ? (
            <video ref={video} muted playsInline className="aspect-video w-full bg-black object-cover" />
          ) : (
            <div className="grid aspect-video place-items-center p-6 text-center text-sm text-muted">
              <div className="space-y-3">
                <ScanLine size={36} className="mx-auto text-accent" />
                {camera === "missing" && <p className="text-warning">{t.noCamera}</p>}
              </div>
            </div>
          )}
        </div>
        <Button type="button" variant="secondary" onClick={() => setCamera(camera === "on" ? "off" : "on")} data-testid="camera">
          {camera === "on" ? <CameraOff size={16} /> : <Camera size={16} />} {camera === "on" ? t.stopCamera : t.useCamera}
        </Button>

        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            last.current = { code: "", at: 0 };
            scan(code);
            setCode("");
          }}
        >
          <label htmlFor="scan-code" className="text-sm font-medium">
            {t.typeCode}
          </label>
          <div className="flex gap-2">
            <input id="scan-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder={t.codePlaceholder} dir="ltr" autoFocus autoComplete="off" className={inputClass} data-testid="scan-code" />
            <Button type="submit" disabled={pending || !code.trim()} data-testid="scan-submit" className="shrink-0">
              {t.scanBtn}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="space-y-4" data-testid="scan-results">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <p className="rounded-lg bg-accent-soft px-3 py-2 font-semibold text-accent-ink" data-testid="scan-done">
            {fmt(t.done, { n: ok })}
          </p>
          <p className="rounded-lg bg-danger-soft px-3 py-2 font-semibold text-danger" data-testid="scan-failed">
            {fmt(t.failed, { n: results.length - ok })}
          </p>
        </div>
        {results.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{t.nothingYet}</p>
        ) : (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
            {results.map((r) => (
              <li key={r.key} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm" data-scan={r.ok ? "ok" : "failed"}>
                {r.ok ? <CircleCheck size={16} className="shrink-0 text-accent" /> : <CircleX size={16} className="shrink-0 text-danger" />}
                <span className="font-semibold tabular-nums" dir="ltr">
                  {r.code}
                </span>
                <span className="ms-auto text-xs text-muted">{r.text}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
