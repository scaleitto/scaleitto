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
          <polyline key={s.name} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" points={s.values.map((v, i) => point(W, i, s.values.length, v, max).join(",")).join(" ")}>
            <title>{s.name}</title>
          </polyline>
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
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${30 - (v / max) * 26}`).join(" ");
  return (
    <svg viewBox="0 0 100 32" className="h-9 w-24 shrink-0" preserveAspectRatio="none" aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" points={pts} />
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
