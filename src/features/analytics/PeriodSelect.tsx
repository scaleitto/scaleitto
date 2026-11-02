"use client";

import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";

// Zimam's period dropdown at the top of Analytics (keeps the open tab)
export function PeriodSelect({ base, tab, value, options }: { base: string; tab: string; value: string; options: { value: string; label: string }[] }) {
  const router = useRouter();
  return (
    <label className="relative inline-flex items-center">
      <CalendarDays size={16} className="pointer-events-none absolute start-3 text-muted" />
      <select
        value={value}
        onChange={(e) => router.push(`${base}?tab=${tab}&period=${e.target.value}`)}
        className="select-chevron h-10 appearance-none rounded-xl border border-line bg-panel ps-9 pe-9 text-sm font-semibold"
        data-testid="period"
        aria-label={options.find((o) => o.value === value)?.label}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
