import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { sectionHref } from "@/lib/permissions";
import { PageHeader } from "@/ui";

export function DeliveryHeader({ lang, t, current }: { lang: string; t: Dictionary; current: "carriers" | "rates" }) {
  const base = sectionHref(lang, "delivery");
  const tabs = [
    { key: "carriers", href: base, label: t.delivery.tabs.carriers },
    { key: "rates", href: `${base}/rates`, label: t.delivery.tabs.rates },
  ] as const;
  return (
    <>
      <PageHeader title={t.sections.delivery.title} description={t.sections.delivery.description} />
      <nav className="mb-5 flex gap-6 border-b border-line text-sm">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={current === tab.key ? "page" : undefined}
            className={`-mb-px border-b-2 pb-2.5 font-semibold ${current === tab.key ? "border-accent text-accent" : "border-transparent text-muted hover:text-fg"}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
