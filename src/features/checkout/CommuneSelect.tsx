"use client";

import { useEffect, useState } from "react";

type Commune = [latin: string, arabic: string];
const cache = new Map<number, Commune[]>();

// The commune list of the chosen wilaya (loaded from /api/communes when the wilaya changes). The value saved is the
// Latin name (what the delivery companies expect); Arabic stores show the Arabic name. If the list cannot be loaded,
// it falls back to a text box so an order is never blocked.
export function CommuneSelect({
  wilaya,
  arabic,
  defaultValue = "",
  className,
  invalid,
  placeholder,
  choose,
  chooseWilayaFirst,
  onBlur,
}: {
  wilaya: number | null;
  arabic: boolean;
  defaultValue?: string;
  className: string;
  invalid?: boolean;
  placeholder: string;
  choose: string;
  chooseWilayaFirst: string;
  onBlur?: () => void;
}) {
  const [list, setList] = useState<Commune[] | "error" | null>(() => (wilaya ? (cache.get(wilaya) ?? null) : null));
  const [value, setValue] = useState(defaultValue);

  // Callers give it key={wilaya}: another wilaya starts a fresh list and an empty choice
  useEffect(() => {
    if (!wilaya || cache.has(wilaya)) return;
    let live = true;
    fetch(`/api/communes?w=${wilaya}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((rows: Commune[]) => {
        cache.set(wilaya, rows);
        if (live) setList(rows.length ? rows : "error");
      })
      .catch(() => live && setList("error"));
    return () => {
      live = false;
    };
  }, [wilaya]);

  const common = { id: "commune", name: "commune", "aria-invalid": invalid, className, onBlur };
  if (list === "error") return <input {...common} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />;

  const rows = wilaya && Array.isArray(list) ? list : [];
  // A commune saved earlier with another spelling stays selectable
  const extra = value && !rows.some(([latin]) => latin === value) ? value : "";
  return (
    <select {...common} className={`${className} select-chevron cursor-pointer appearance-none pe-10`} value={rows.length || extra ? value : ""} onChange={(e) => setValue(e.target.value)} disabled={!wilaya}>
      <option value="">{wilaya ? choose : chooseWilayaFirst}</option>
      {extra && <option value={extra}>{extra}</option>}
      {rows.map(([latin, ar]) => (
        <option key={latin} value={latin}>
          {arabic ? ar : latin}
        </option>
      ))}
    </select>
  );
}
