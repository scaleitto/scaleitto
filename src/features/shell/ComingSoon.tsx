import { Hammer } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { Badge, Card, PageHeader } from "@/ui";
import type { SectionKey } from "@/lib/permissions";

// Placeholder for sections that are not rebuilt yet: says what the section will contain.
export function ComingSoon({ t, section }: { t: Dictionary; section: Exclude<SectionKey, "overview" | "profile"> }) {
  const info = t.sections[section];
  return (
    <>
      <PageHeader title={info.title} description={info.description} actions={<Badge tone="warning">{t.common.comingSoon}</Badge>} />
      <Card className="flex items-start gap-4">
        <Hammer className="mt-1 shrink-0 text-amber-300" size={22} aria-hidden />
        <div>
          <h2 className="font-semibold">{t.comingSoon.title}</h2>
          <p className="mt-1 text-sm text-muted">{t.comingSoon.body}</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted">
            {info.upcoming.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </div>
      </Card>
    </>
  );
}
