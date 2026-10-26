import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { getDictionary, asLocale } from "@/i18n";
import { requireManager } from "@/lib/auth";
import { trackingIdPatterns } from "@/lib/tracking-ids";

async function saveTracking(lang: string, formData: FormData) {
  "use server";
  const locale = asLocale(lang);
  const { shop } = await requireManager(locale);
  const read = (key: keyof typeof trackingIdPatterns) => String(formData.get(key) ?? "").trim();
  const values = { metaPixelId: read("metaPixelId"), tiktokPixelId: read("tiktokPixelId"), gtmId: read("gtmId").toUpperCase() };
  for (const key of Object.keys(values) as (keyof typeof values)[]) {
    if (values[key] && !trackingIdPatterns[key].test(values[key])) redirect(`/${locale}/dashboard/tracking?error=1`);
  }
  await db
    .update(schema.shops)
    .set({ metaPixelId: values.metaPixelId || null, tiktokPixelId: values.tiktokPixelId || null, gtmId: values.gtmId || null })
    .where(eq(schema.shops.id, shop.id));
  redirect(`/${locale}/dashboard/tracking?saved=1`);
}

export default async function TrackingPage({ params, searchParams }: PageProps<"/[lang]/dashboard/tracking">) {
  const lang = asLocale((await params).lang);
  const { saved, error } = await searchParams;
  const t = getDictionary(lang);
  const { shop } = await requireManager(lang);
  const tr = t.tracking;

  const fields = [
    { name: "metaPixelId", label: tr.metaPixel, hint: tr.metaPixelHint, value: shop.metaPixelId },
    { name: "tiktokPixelId", label: tr.tiktokPixel, hint: tr.tiktokPixelHint, value: shop.tiktokPixelId },
    { name: "gtmId", label: tr.gtm, hint: tr.gtmHint, value: shop.gtmId },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{tr.title}</h1>
      <p className="text-sm text-slate-600">{tr.hint}</p>
      {saved && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{t.common.saved}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{tr.invalid}</p>}
      <form action={saveTracking.bind(null, lang)} className="card space-y-4">
        {fields.map((f) => (
          <div key={f.name}>
            <label className="label" htmlFor={f.name}>{f.label}</label>
            <input className="input font-mono" id={f.name} name={f.name} dir="ltr" defaultValue={f.value ?? ""} />
            <p className="mt-1 text-xs text-slate-500">{f.hint}</p>
          </div>
        ))}
        <button className="btn">{t.common.save}</button>
      </form>
    </div>
  );
}
