"use client";

import { Printer } from "lucide-react";
import { useSelectedCount, selectedRows } from "@/features/orders/OrderTools";
import { fmt } from "@/lib/format";
import { Button, buttonClass } from "@/ui";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("primary")} aria-label="Print" title="Print" data-testid="print-now">
      <Printer size={16} />
    </button>
  );
}

// Orders page: the selected parcels' handover manifest in a new tab
export function ManifestButton({ lang, label }: { lang: string; label: string }) {
  const count = useSelectedCount();
  return (
    <Button
      type="button"
      variant="secondary"
      disabled={!count}
      data-testid="print-manifest"
      onClick={() => window.open(`/${lang}/print/manifest?ids=${selectedRows().map((r) => r.id).join(",")}`, "_blank")}
    >
      <Printer size={15} /> {fmt(label, { n: count })}
    </Button>
  );
}
