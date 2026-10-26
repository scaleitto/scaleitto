export function UsageBar({ label, used, limit, unlimitedLabel }: { label: string; used: number; limit: number; unlimitedLabel: string }) {
  const pct = limit === -1 ? 0 : limit === 0 ? 100 : Math.min(100, Math.round((used / limit) * 100));
  const color = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-brand";
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold" dir="ltr">
          {used} / {limit === -1 ? unlimitedLabel : limit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${color}`} style={{ width: `${limit === -1 ? 3 : pct}%` }} />
      </div>
    </div>
  );
}
