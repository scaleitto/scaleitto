import { notFound, redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import type { Limits } from "@/db/schema";
import { getDictionary, asLocale } from "@/i18n";
import { newId, requireAdmin } from "@/lib/auth";
import { getEffectiveLimits, getUsage } from "@/lib/limits";
import { UsageBar } from "@/components/UsageBar";

const limitField = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(-1).nullable());

async function saveContract(lang: string, shopId: string, formData: FormData) {
  "use server";
  await requireAdmin(lang);
  const d = z
    .object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
      maxProducts: limitField,
      maxOrdersPerMonth: limitField,
      maxStaff: limitField,
      maxAiPerMonth: limitField,
      alertThreshold: z.coerce.number().int().min(1).max(100),
      priceMonthly: limitField,
      notes: z.string().max(2000).optional().default(""),
    })
    .parse(Object.fromEntries(formData));
  const limits: Limits = { maxProducts: d.maxProducts, maxOrdersPerMonth: d.maxOrdersPerMonth, maxStaff: d.maxStaff, maxAiPerMonth: d.maxAiPerMonth };
  await db.insert(schema.shopContracts).values({
    id: newId(),
    shopId,
    startDate: d.startDate,
    endDate: d.endDate || null,
    limits,
    alertThreshold: d.alertThreshold,
    priceMonthly: d.priceMonthly,
    notes: d.notes || null,
  });
  redirect(`/${lang}/admin/shops/${shopId}`);
}

async function updateShop(lang: string, shopId: string, formData: FormData) {
  "use server";
  await requireAdmin(lang);
  const planId = String(formData.get("planId") ?? "");
  const status = formData.get("status") === "suspended" ? "suspended" : "active";
  await db.update(schema.shops).set({ planId, status }).where(eq(schema.shops.id, shopId));
  redirect(`/${lang}/admin/shops/${shopId}`);
}

async function deleteContract(lang: string, shopId: string, contractId: string) {
  "use server";
  await requireAdmin(lang);
  await db.delete(schema.shopContracts).where(eq(schema.shopContracts.id, contractId));
  redirect(`/${lang}/admin/shops/${shopId}`);
}

export default async function AdminShopPage({ params }: PageProps<"/[lang]/admin/shops/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = asLocale(rawLang);
  const t = getDictionary(lang);
  await requireAdmin(lang);
  const [shop] = await db.select().from(schema.shops).where(eq(schema.shops.id, id));
  if (!shop) notFound();
  const [plans, contracts, effective, usage] = await Promise.all([
    db.select().from(schema.plans),
    db.select().from(schema.shopContracts).where(eq(schema.shopContracts.shopId, id)).orderBy(desc(schema.shopContracts.startDate)),
    getEffectiveLimits(id),
    getUsage(id),
  ]);
  const a = t.admin;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{shop.name} <span className="text-base font-normal text-slate-400" dir="ltr">({shop.slug})</span></h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <form action={updateShop.bind(null, lang, id)} className="card space-y-4">
          <div>
            <label className="label">{a.plan}</label>
            <select name="planId" defaultValue={shop.planId} className="input">
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {p.priceMonthly} {t.common.currency}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{a.status}</label>
            <select name="status" defaultValue={shop.status} className="input">
              <option value="active">{a.activate}</option>
              <option value="suspended">{a.suspend}</option>
            </select>
          </div>
          <button className="btn">{t.common.save}</button>
        </form>

        <div className="card space-y-4">
          <h2 className="font-bold">{a.usage}</h2>
          <UsageBar label={a.maxProducts} used={usage.maxProducts} limit={effective.limits.maxProducts} unlimitedLabel={t.common.unlimited} />
          <UsageBar label={a.maxOrders} used={usage.maxOrdersPerMonth} limit={effective.limits.maxOrdersPerMonth} unlimitedLabel={t.common.unlimited} />
          <UsageBar label={a.maxStaff} used={usage.maxStaff} limit={effective.limits.maxStaff} unlimitedLabel={t.common.unlimited} />
          <UsageBar label={a.maxAi} used={usage.maxAiPerMonth} limit={effective.limits.maxAiPerMonth} unlimitedLabel={t.common.unlimited} />
        </div>
      </div>

      <form action={saveContract.bind(null, lang, id)} className="card space-y-4">
        <h2 className="font-bold">{a.contract}</h2>
        <p className="text-sm text-slate-500">{a.limitsHint}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><label className="label">{a.startDate}</label><input name="startDate" type="date" required className="input" defaultValue={new Date().toISOString().slice(0, 10)} /></div>
          <div><label className="label">{a.endDate}</label><input name="endDate" type="date" className="input" /></div>
          <div><label className="label">{a.price}</label><input name="priceMonthly" type="number" min={0} className="input" /></div>
          <div><label className="label">{a.threshold}</label><input name="alertThreshold" type="number" min={1} max={100} defaultValue={80} className="input" /></div>
          <div><label className="label">{a.maxProducts}</label><input name="maxProducts" type="number" min={-1} className="input" /></div>
          <div><label className="label">{a.maxOrders}</label><input name="maxOrdersPerMonth" type="number" min={-1} className="input" /></div>
          <div><label className="label">{a.maxStaff}</label><input name="maxStaff" type="number" min={-1} className="input" /></div>
          <div><label className="label">{a.maxAi}</label><input name="maxAiPerMonth" type="number" min={-1} className="input" /></div>
        </div>
        <div><label className="label">{a.notes}</label><textarea name="notes" className="input" /></div>
        <button className="btn">{a.saveContract}</button>
      </form>

      {contracts.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead>
              <tr>
                <th>{a.startDate}</th><th>{a.endDate}</th><th>{a.maxProducts}</th><th>{a.maxOrders}</th><th>{a.price}</th><th />
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id} className={effective.contract?.id === c.id ? "bg-amber-50" : ""}>
                  <td>{c.startDate}</td>
                  <td>{c.endDate ?? "—"}</td>
                  <td>{c.limits.maxProducts ?? "—"}</td>
                  <td>{c.limits.maxOrdersPerMonth ?? "—"}</td>
                  <td>{c.priceMonthly ?? "—"}</td>
                  <td>
                    <form action={deleteContract.bind(null, lang, id, c.id)}>
                      <button className="btn-danger">{t.common.delete}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
