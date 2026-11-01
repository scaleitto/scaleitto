"use client";

import { useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Star, Trash2, Upload } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt } from "@/lib/format";
import { buttonClass } from "./index";

// Shrinks a photo in the browser (max 1600px, WebP/JPEG) so uploads are small and the
// server needs no image library. GIFs and already-small files are sent as they are.
async function shrink(file: File): Promise<Blob> {
  if (file.type === "image/gif" || file.size < 300 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const encode = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
    let blob = await encode("image/webp");
    if (!blob || blob.type !== "image/webp") blob = await encode("image/jpeg");
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file; // the browser cannot decode it; the server decides
  }
}

type UploadResult = { url: string } | { error: keyof Dictionary["media"]["errors"] };

// One image per request keeps every request small (shared hosting limits request size).
export async function uploadOne(file: File): Promise<UploadResult> {
  try {
    const body = await shrink(file);
    const res = await fetch("/api/uploads", { method: "POST", body, headers: { "Content-Type": body.type || "application/octet-stream" } });
    const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (res.ok && json.url) return { url: json.url };
    const known = ["type", "size", "empty", "auth"] as const;
    return { error: known.find((k) => k === json.error) ?? (res.status === 413 ? "size" : "unexpected") };
  } catch {
    return { error: "network" };
  }
}

// Product/landing images. The first image is the main one.
// `dropzone`: the big dashed "click to upload" area (product form), also accepting dropped files
export function ImageManager({ t, value, onChange, max = 10, dropzone = false }: { t: Dictionary["media"]; value: string[]; onChange: (images: string[]) => void; max?: number; dropzone?: boolean }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setProblems([]);
    const added: string[] = [];
    const failed: string[] = [];
    for (const file of Array.from(files).slice(0, max - value.length)) {
      const result = await uploadOne(file);
      if ("url" in result) added.push(result.url);
      else failed.push(`${file.name}: ${t.errors[result.error]}`);
    }
    if (added.length) onChange([...value, ...added].slice(0, max));
    setProblems(failed);
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5" data-testid="images">
          {value.map((src, i) => (
            <li key={src} className={`group relative aspect-square overflow-hidden rounded-lg border bg-bg ${i === 0 ? "border-accent ring-2 ring-accent/30" : "border-line"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
              {i === 0 && <span className="absolute start-1.5 top-1.5 rounded bg-accent px-1.5 text-[10px] font-bold text-accent-fg">{t.main}</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 p-1 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                {i > 0 ? (
                  <button type="button" title={t.makeMain} aria-label={t.makeMain} className="rounded p-1 text-white hover:text-accent" onClick={() => onChange([src, ...value.filter((_, j) => j !== i)])}>
                    <Star size={15} />
                  </button>
                ) : (
                  <span />
                )}
                <button type="button" title={t.remove} aria-label={t.remove} className="rounded p-1 text-white hover:text-danger" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {value.length < max && (
        <>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" data-testid="image-input" onChange={(e) => upload(e.target.files)} />
          {dropzone ? (
            <button
              type="button"
              className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line px-4 py-10 text-center transition hover:border-accent/50 hover:bg-accent-soft/30 disabled:opacity-60"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                upload(e.dataTransfer.files);
              }}
              data-testid="image-dropzone"
            >
              <span className="grid size-14 place-items-center rounded-full bg-accent-soft text-accent">
                {uploading ? <LoaderCircle size={24} className="animate-spin" /> : <Upload size={24} />}
              </span>
              <span className="text-lg font-semibold text-fg">{uploading ? t.uploading : t.dropTitle}</span>
              <span className="text-sm text-muted">{fmt(t.hint, { max })}</span>
            </button>
          ) : (
            <button type="button" className={buttonClass("secondary")} disabled={uploading} onClick={() => fileInput.current?.click()}>
              {uploading ? <LoaderCircle size={16} className="animate-spin" /> : <ImagePlus size={16} />}
              {uploading ? t.uploading : t.upload}
            </button>
          )}
        </>
      )}
      {!(dropzone && value.length < max) && <p className="text-xs text-muted">{fmt(t.hint, { max })}</p>}
      {problems.length > 0 && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          <p className="font-semibold">{t.failed}</p>
          <ul className="mt-1 list-inside list-disc">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
