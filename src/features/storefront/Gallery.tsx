"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";

export function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const [current, setCurrent] = useState(0);
  if (!images.length)
    return (
      <div className="flex aspect-square items-center justify-center rounded-2xl bg-slate-100">
        <ImageOff size={48} className="text-slate-300" />
      </div>
    );
  return (
    <div className="space-y-3">
      <div className="aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[current]} alt={alt} className="size-full object-cover" />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setCurrent(i)}
              aria-label={`${i + 1}`}
              className={`size-16 shrink-0 overflow-hidden rounded-lg border-2 ${i === current ? "border-brand" : "border-transparent opacity-70"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
