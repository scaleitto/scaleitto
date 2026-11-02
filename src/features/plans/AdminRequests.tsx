"use client";

import { useState, useTransition } from "react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { Button, Input } from "@/ui";
import { decidePlanRequest } from "./actions";
import { decideCreditPurchase } from "@/features/credits/actions";

// Approve / reject one pending request, with an optional note shown to the merchant
export function DecideRequest({ lang, id, kind = "plan", t }: { lang: string; id: string; kind?: "plan" | "credits"; t: Dictionary["admin"] }) {
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const decide = (approve: boolean) => startTransition(async () => void (await (kind === "credits" ? decideCreditPurchase : decidePlanRequest)(lang, id, approve, note)));
  return (
    <div className="flex flex-wrap items-center gap-2" data-decide={id}>
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.note} maxLength={500} className="w-48 py-1.5 text-xs" aria-label={t.note} />
      <Button className="py-1.5 text-xs" disabled={pending} onClick={() => decide(true)}>
        {t.approve}
      </Button>
      <Button variant="secondary" className="py-1.5 text-xs hover:text-danger" disabled={pending} onClick={() => decide(false)}>
        {t.reject}
      </Button>
    </div>
  );
}
