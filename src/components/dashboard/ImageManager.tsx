"use client";

import { useRef, useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries/ar";

// Product/landing images: upload from the device or add by link. The first image is the main one.
export function ImageManager({
  t,
  name,
  value,
  onChange,
  max = 10,
}: {
  t: Dictionary;
  name?: string;
  value: string[];
  onChange: (images: string[]) => void;
  max?: number;
}) {
  const m = t.media;
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState("");

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    const body = new FormData();
    for (const f of Array.from(files).slice(0, max - value.length)) body.append("files", f);
    try {
      const res = await fetch("/api/uploads", { method: "POST", body });
      const json = (await res.json()) as { urls?: string[]; errors?: string[] };
      if (json.urls?.length) onChange([...value, ...json.urls].slice(0, max));
      if (!res.ok || json.errors?.length) setError(`${m.failed}${json.errors?.length ? `: ${json.errors.join("، ")}` : ""}`);
    } catch {
      setError(m.failed);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      {name && <input type="hidden" name={name} value={value.join("\n")} />}
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {value.map((src, i) => (
            <div key={src + i} className={`group relative aspect-square overflow-hidden rounded-lg border ${i === 0 ? "border-brand ring-2 ring-brand/30" : "border-slate-200"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
              {i === 0 && <span className="absolute start-1 top-1 rounded bg-brand px-1.5 text-[10px] font-bold text-white">{m.main}</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                {i > 0 ? (
                  <button type="button" className="text-xs text-white" onClick={() => onChange([src, ...value.filter((_, j) => j !== i)])}>★</button>
                ) : (
                  <span />
                )}
                <button type="button" className="text-xs text-white" onClick={() => onChange(value.filter((_, j) => j !== i))}>✕ {m.remove}</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {value.length < max && (
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
          <button type="button" className="btn-outline" disabled={uploading} onClick={() => fileInput.current?.click()}>
            {uploading ? m.uploading : m.upload}
          </button>
          <input className="input min-w-0 flex-1 font-mono text-xs" dir="ltr" placeholder={`${m.addUrl}: https://…`} value={link} onChange={(e) => setLink(e.target.value)} />
          <button
            type="button"
            className="btn-outline"
            disabled={!/^https?:\/\/\S+$/.test(link.trim())}
            onClick={() => {
              onChange([...value, link.trim()].slice(0, max));
              setLink("");
            }}
          >
            {m.add}
          </button>
        </div>
      )}
      <p className="text-xs text-slate-500">{m.hint}</p>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
