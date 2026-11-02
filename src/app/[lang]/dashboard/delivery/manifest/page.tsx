import { eq } from "drizzle-orm";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { db, schema } from "@/server/db";
import { ManifestEditor } from "@/features/delivery/ManifestEditor";
import { resolveManifest } from "@/features/delivery/settings";

// Delivery → handover manifest template
export default async function ManifestPage({ params }: PageProps<"/[lang]/dashboard/delivery/manifest">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop } = await requireSection(lang, "manifest");
  const [row] = await db.select({ manifest: schema.shops.manifest }).from(schema.shops).where(eq(schema.shops.id, shop.id));
  const settings = resolveManifest(row?.manifest);
  const state = !settings.published ? (row?.manifest ? "draft" : "default") : JSON.stringify(settings.published) === JSON.stringify(settings.draft) ? "published" : "draft";
  return (
    <>
      <ManifestEditor lang={lang} initial={settings.draft} state={state} store={{ name: shop.name, logo: shop.logoUrl }} t={{ delivery: t.delivery, errors: t.errors }} />
    </>
  );
}
