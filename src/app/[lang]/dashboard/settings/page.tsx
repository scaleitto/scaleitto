import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { getDictionary, asLocale, locales, localeNames } from "@/i18n";
import { requireManager } from "@/lib/auth";

const settingsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).optional().default(""),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  defaultLocale: z.enum(locales),
  logoUrl: z.union([z.literal(""), z.string().url().max(500)]).default(""),
});

async function saveSettings(lang: string, formData: FormData) {
  "use server";
  const locale = asLocale(lang);
  const { shop } = await requireManager(locale);
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/${locale}/dashboard/settings?error=1`);
  const d = parsed.data;
  await db
    .update(schema.shops)
    .set({ name: d.name, phone: d.phone || null, primaryColor: d.primaryColor, defaultLocale: d.defaultLocale, logoUrl: d.logoUrl || null })
    .where(eq(schema.shops.id, shop.id));
  redirect(`/${locale}/dashboard/settings?saved=1`);
}

export default async function SettingsPage({ params, searchParams }: PageProps<"/[lang]/dashboard/settings">) {
  const lang = asLocale((await params).lang);
  const { saved, error } = await searchParams;
  const t = getDictionary(lang);
  const { shop } = await requireManager(lang);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{t.settings.title}</h1>
      {saved && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{t.common.saved}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{t.auth.errors.validation}</p>}
      <form action={saveSettings.bind(null, lang)} className="card space-y-4">
        <div>
          <label className="label" htmlFor="name">{t.settings.name}</label>
          <input className="input" id="name" name="name" required defaultValue={shop.name} />
        </div>
        <div>
          <label className="label" htmlFor="phone">{t.settings.phone}</label>
          <input className="input" id="phone" name="phone" dir="ltr" defaultValue={shop.phone ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="logoUrl">{t.settings.logo}</label>
          <input className="input" id="logoUrl" name="logoUrl" type="url" dir="ltr" defaultValue={shop.logoUrl ?? ""} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="primaryColor">{t.settings.color}</label>
            <input className="h-10 w-full cursor-pointer rounded-lg border border-slate-300" id="primaryColor" name="primaryColor" type="color" defaultValue={shop.primaryColor} />
          </div>
          <div>
            <label className="label" htmlFor="defaultLocale">{t.settings.language}</label>
            <select className="input" id="defaultLocale" name="defaultLocale" defaultValue={shop.defaultLocale}>
              {locales.map((l) => (
                <option key={l} value={l}>{localeNames[l]}</option>
              ))}
            </select>
          </div>
        </div>
        <button className="btn">{t.common.save}</button>
      </form>
    </div>
  );
}
