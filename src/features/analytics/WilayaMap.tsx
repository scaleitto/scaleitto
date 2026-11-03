// Zimam's "Orders by wilaya" map: Algeria's wilayas coloured by their number of orders (darker = more), the count in each
// wilaya's tooltip. Server component, plain SVG. Boundaries © OpenStreetMap contributors (ODbL), see src/lib/algeria-map.ts.
import { MAP_HEIGHT, MAP_WIDTH, mapParent, wilayaPaths } from "@/lib/algeria-map";
import { wilayaTitle } from "@/lib/wilayas";

const shades = ["var(--color-panel-2)", "#bfe8d4", "#7fd0a9", "#3fb17d", "#0f8a57"];

export function WilayaMap({ counts, lang, label, attribution }: { counts: Record<number, number>; lang: string; label: string; attribution: string }) {
  const max = Math.max(0, ...Object.values(counts));
  // 0 = no orders; otherwise four steps up to the busiest wilaya
  const step = (n: number) => (n <= 0 || max <= 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
  const legend = max <= 0 ? [0] : [0, ...Array.from(new Set([1, 2, 3, 4].map((s) => Math.max(1, Math.round((max * s) / 4)))))];
  return (
    <div className="space-y-3" data-testid="wilaya-map">
      <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="mx-auto h-auto w-full max-w-md" role="img" aria-label={label}>
        {wilayaPaths.map(([code, d]) => {
          const own = mapParent[code] ?? code;
          const n = counts[own] ?? 0;
          return (
            <path key={code} d={d} fill={shades[step(n)]} stroke="var(--color-panel)" strokeWidth="0.8" data-map-wilaya={code} data-orders={n}>
              <title>{`${wilayaTitle(own, lang)}: ${n}`}</title>
            </path>
          );
        })}
      </svg>
      <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted">
        {legend.map((n) => (
          <span key={n} className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm border border-line" style={{ background: shades[step(n)] }} />
            {n}
          </span>
        ))}
      </div>
      <p className="text-center text-[10px] text-muted">{attribution}</p>
    </div>
  );
}
