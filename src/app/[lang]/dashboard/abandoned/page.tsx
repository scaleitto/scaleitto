import Link from "next/link";
import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getDictionary, asLocale } from "@/i18n";
import { requireShop } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { wilayaName } from "@/lib/wilayas";

const statuses = ["abandoned", "contacted", "converted"] as const;
type LeadStatus = (typeof statuses)[number];

async function setLeadStatus(lang: string, leadId: string, status: LeadStatus) {
  "use server";
  const { shop } = await requireShop(asLocale(lang));
  await db.update(schema.leads).set({ status }).where(and(eq(schema.leads.id, leadId), eq(schema.leads.shopId, shop.id)));
  revalidatePath(`/${lang}/dashboard/abandoned`);
}

async function deleteLead(lang: string, leadId: string) {
  "use server";
  const { shop } = await requireShop(asLocale(lang));
  await db.delete(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.shopId, shop.id)));
  revalidatePath(`/${lang}/dashboard/abandoned`);
}

// 0555123456 → 213555123456 for wa.me links
const whatsappNumber = (phone: string) => `213${phone.replace(/^0/, "")}`;

export default async function AbandonedPage({ params, searchParams }: PageProps<"/[lang]/dashboard/abandoned">) {
  const lang = asLocale((await params).lang);
  const { status } = await searchParams;
  const t = getDictionary(lang);
  const { shop } = await requireShop(lang);
  const filter: LeadStatus = statuses.includes(status as LeadStatus) ? (status as LeadStatus) : "abandoned";
  const a = t.abandoned;

  const leads = await db
    .select({ lead: schema.leads, productName: schema.products.name })
    .from(schema.leads)
    .leftJoin(schema.products, eq(schema.products.id, schema.leads.productId))
    .where(and(eq(schema.leads.shopId, shop.id), eq(schema.leads.status, filter)))
    .orderBy(desc(schema.leads.updatedAt))
    .limit(200);

  const base = `/${lang}/dashboard/abandoned`;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{a.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{a.hint}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <Link key={s} href={`${base}?status=${s}`} className={filter === s ? "btn" : "btn-outline"}>
            {a.statuses[s]}
          </Link>
        ))}
      </div>
      {leads.length === 0 ? (
        <div className="card text-center text-slate-500">{a.empty}</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead>
              <tr>
                <th>{t.orders.customer}</th>
                <th>{t.orders.phone}</th>
                <th>{a.product}</th>
                <th>{t.orders.wilaya}</th>
                <th>{a.lastSeen}</th>
                <th>{t.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(({ lead, productName }) => (
                <tr key={lead.id}>
                  <td>{lead.name ?? "—"}</td>
                  <td dir="ltr" className="whitespace-nowrap text-start">{lead.phone}</td>
                  <td>{productName ?? "—"}</td>
                  <td>{lead.wilayaCode ? wilayaName(lead.wilayaCode, lang) : "—"}</td>
                  <td className="whitespace-nowrap text-slate-500">{formatDate(lead.updatedAt, lang)}</td>
                  <td>
                    <div className="flex flex-wrap items-center gap-1">
                      <a href={`tel:${lead.phone}`} className="btn-outline px-2 py-1 text-xs">{a.call}</a>
                      <a href={`https://wa.me/${whatsappNumber(lead.phone)}`} target="_blank" rel="noreferrer" className="btn-outline px-2 py-1 text-xs text-green-700">
                        {a.whatsapp}
                      </a>
                      {lead.status === "abandoned" && (
                        <form action={setLeadStatus.bind(null, lang, lead.id, "contacted")}>
                          <button className="btn-outline px-2 py-1 text-xs">{a.markContacted}</button>
                        </form>
                      )}
                      {lead.status === "converted" && lead.orderId && (
                        <Link href={`/${lang}/dashboard/orders/${lead.orderId}`} className="btn-outline px-2 py-1 text-xs">{t.common.view}</Link>
                      )}
                      <form action={deleteLead.bind(null, lang, lead.id)}>
                        <button className="btn-danger px-2 py-1 text-xs">{t.common.delete}</button>
                      </form>
                    </div>
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
