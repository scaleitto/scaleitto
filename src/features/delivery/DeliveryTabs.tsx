import type { Dictionary } from "@/i18n/dictionaries/ar";
import { PageHeader } from "@/ui";

// The delivery pages' title (the sub-pages are tabs of the shell: companies, handover manifest, settings)
export function DeliveryHeader({ t }: { t: Dictionary }) {
  return <PageHeader title={t.sections.delivery.title} description={t.sections.delivery.description} />;
}
