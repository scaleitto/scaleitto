// Small SVG charts for the analytics tabs (server components, no library). Charts always read left to right.
import type { ReactNode } from "react";

const BASE_W = 600;
const H = 220;
const PAD = { top: 12, right: 12, bottom: 28, left: 44 };

const niceMax = (n: number) => {
  if (n <= 1) return 1;
  const p = 10 ** Math.floor(Math.log10(n));
  const m = n / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
};
const short = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10}K` : String(Math.round(n * 100) / 100));
// At most ~8 labels under a chart
const labelEvery = (count: number) => Math.max(1, Math.ceil(count / 8));

function Frame({ max, labels, format = short, W, children }: { max: number; labels: string[]; format?: (n: number) => string; W: number; children: ReactNode }) {
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const every = labelEvery(labels.length);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" direction="ltr" role="img">
      {ticks.map((tk) => {
        const y = PAD.top + plotH * (1 - tk);
        return (
          <g key={tk}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="var(--color-line)" strokeDasharray="3 4" />
            <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="var(--color-muted)">
              {format(max * tk)}
            </text>
          </g>
        );
      })}
      {labels.map((l, i) =>
        i % every === 0 || i === labels.length - 1 ? (
          <text key={l + i} x={PAD.left + (labels.length === 1 ? plotW / 2 : (plotW * i) / (labels.length - 1))} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--color-muted)">
            {l}
          </text>
        ) : null,
      )}
      {children}
    </svg>
  );
}

const point = (W: number, i: number, count: number, v: number, max: number) => {
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  return [PAD.left + (count === 1 ? plotW / 2 : (plotW * i) / (count - 1)), PAD.top + plotH * (1 - v / max)] as const;
};

// A smooth line through the points that never overshoots them (monotone cubic, Fritsch–Carlson), like Zimam's curves
export function smoothPath(pts: readonly (readonly [number, number])[]) {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const n = pts.length;
  const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0]);
  const slope = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / (dx[i] || 1));
  const m = pts.map((_, i) => (i === 0 ? slope[0] : i === n - 1 ? slope[n - 2] : slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[i] = t * a * slope[i];
      m[i + 1] = t * b * slope[i];
    }
  }
  const f = (v: number) => Math.round(v * 10) / 10;
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${f(pts[i][0] + h)},${f(pts[i][1] + m[i] * h)} ${f(pts[i + 1][0] - h)},${f(pts[i + 1][1] - m[i + 1] * h)} ${f(pts[i + 1][0])},${f(pts[i + 1][1])}`;
  }
  return d;
}

export type Series = { name: string; values: number[]; color: string };

// Lines over days (one or more series)
// wide: a full-width chart gets a wider drawing so its text keeps the same size
export function LineChart({ labels, series, format, testId, wide = false }: { labels: string[]; series: Series[]; format?: (n: number) => string; testId?: string; wide?: boolean }) {
  const W = wide ? 1200 : BASE_W;
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  return (
    <div data-testid={testId}>
      <Frame max={max} labels={labels} format={format} W={W}>
        {series.map((s) => (
          <path key={s.name} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" d={smoothPath(s.values.map((v, i) => point(W, i, s.values.length, v, max)))}>
            <title>{s.name}</title>
          </path>
        ))}
      </Frame>
      {series.length > 1 && <Legend items={series.map((s) => ({ label: s.name, color: s.color }))} />}
    </div>
  );
}

// Bars per day: the period (solid) and the period before (faded)
export function BarChart({ labels, current, previous, names, testId }: { labels: string[]; current: number[]; previous: number[]; names: [string, string]; testId?: string }) {
  const W = BASE_W;
  const max = niceMax(Math.max(0, ...current, ...previous));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(1, labels.length);
  const bar = Math.min(18, slot / 3);
  return (
    <div data-testid={testId}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" direction="ltr" role="img">
        {[0, 0.25, 0.5, 0.75, 1].map((tk) => {
          const y = PAD.top + plotH * (1 - tk);
          return (
            <g key={tk}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="var(--color-line)" strokeDasharray="3 4" />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="var(--color-muted)">
                {short(max * tk)}
              </text>
            </g>
          );
        })}
        {labels.map((l, i) => {
          const x = PAD.left + slot * i + slot / 2;
          const h1 = (plotH * current[i]) / max;
          const h0 = (plotH * (previous[i] ?? 0)) / max;
          return (
            <g key={l + i}>
              <rect x={x - bar - 1} y={PAD.top + plotH - h0} width={bar} height={h0} rx="3" fill="var(--color-line)">
                <title>{`${names[1]}: ${previous[i] ?? 0}`}</title>
              </rect>
              <rect x={x + 1} y={PAD.top + plotH - h1} width={bar} height={h1} rx="3" fill="var(--color-accent)">
                <title>{`${l} · ${names[0]}: ${current[i]}`}</title>
              </rect>
              {(i % labelEvery(labels.length) === 0 || i === labels.length - 1) && (
                <text x={x} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--color-muted)">
                  {l}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <Legend
        items={[
          { label: names[0], color: "var(--color-accent)" },
          { label: names[1], color: "var(--color-line)" },
        ]}
      />
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

// A small trend line inside a KPI card
export function Spark({ values, color = "var(--color-accent)" }: { values: number[]; color?: string }) {
  if (values.length < 2 || values.every((v) => v === 0)) return null;
  const max = Math.max(...values) || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, 30 - (v / max) * 26] as const);
  return (
    <svg viewBox="0 0 100 32" className="h-9 w-24 shrink-0" preserveAspectRatio="none" aria-hidden>
      <path fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" d={smoothPath(pts)} />
    </svg>
  );
}

// A ring split in parts, with the total in the middle
export function Donut({ parts, center, sub }: { parts: { value: number; color: string }[]; center: ReactNode; sub: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const r = 40;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative mx-auto size-44 shrink-0">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-line)" strokeWidth="14" />
        {total > 0 &&
          parts
            .filter((p) => p.value > 0)
            .map((p, i) => {
              const len = (p.value / total) * c;
              const el = <circle key={i} cx="50" cy="50" r={r} fill="none" stroke={p.color} strokeWidth="14" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />;
              offset += len;
              return el;
            })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums">{center}</span>
        <span className="text-xs text-muted">{sub}</span>
      </div>
    </div>
  );
}

// Zimam's order funnel: one shape narrowing from stage to stage (its height = the stage's share of the first one), coloured
// from blue to red, with each stage's rate (share of the previous stage) on a pill where it starts
export function FunnelShape({ steps }: { steps: { n: number; rate: number | null }[] }) {
  const W = 600;
  const H = 150;
  const cy = H / 2;
  const first = steps[0]?.n ?? 0;
  const height = (n: number) => (first ? Math.max(10, (n / first) * (H - 10)) : 10);
  const seg = W / steps.length;
  const hs = steps.map((s) => height(s.n));
  let top = `M0,${cy - hs[0] / 2}`;
  steps.forEach((_, i) => {
    const x0 = i * seg;
    const x1 = (i + 1) * seg;
    const a = hs[i];
    const b = hs[Math.min(i + 1, steps.length - 1)];
    // The first stage keeps its height for a short while, then curves down to the next one
    const xa = x0 + seg * 0.15;
    const xb = x0 + seg * 0.65;
    top += `L${xa},${cy - a / 2}C${(xa + xb) / 2},${cy - a / 2} ${(xa + xb) / 2},${cy - b / 2} ${xb},${cy - b / 2}L${x1},${cy - b / 2}`;
  });
  // The bottom edge, drawn back from right to left
  const reversed = [`L${W},${cy + hs[hs.length - 1] / 2}`];
  for (let i = steps.length - 1; i >= 0; i--) {
    const x0 = i * seg;
    const a = hs[i];
    const b = hs[Math.min(i + 1, steps.length - 1)];
    const xa = x0 + seg * 0.15;
    const xb = x0 + seg * 0.65;
    reversed.push(`L${xb},${cy + b / 2}C${(xa + xb) / 2},${cy + b / 2} ${(xa + xb) / 2},${cy + a / 2} ${xa},${cy + a / 2}L${x0},${cy + a / 2}`);
  }
  const d = `${top}${reversed.join("")}Z`;
  const label = (r: number | null) => (r === null ? "-" : `${r.toFixed(1)}%`);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" direction="ltr" role="img" data-testid="funnel-shape">
      <defs>
        <linearGradient id="funnel-fill" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#2f8fd8" />
          <stop offset="30%" stopColor="#139c7c" />
          <stop offset="65%" stopColor="#e4891f" />
          <stop offset="100%" stopColor="#d9483b" />
        </linearGradient>
      </defs>
      <path d={d} fill="url(#funnel-fill)" />
      {steps.map((s, i) => {
        const x = i === 0 ? 34 : i * seg;
        const text = label(s.rate);
        const w = text.length * 7.5 + 18;
        return (
          <g key={i}>
            <rect x={x - w / 2} y={cy - 12} width={w} height={24} rx={12} fill="white" stroke="#e5e7eb" />
            <text x={x} y={cy + 4.5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#111827">
              {text}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
