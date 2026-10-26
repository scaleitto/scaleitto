import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { getDictionary, asLocale } from "@/i18n";
import { requireShop } from "@/lib/auth";
import { wilayas } from "@/lib/wilayas";

function priceOrNull(v: FormDataEntryValue | null) {
  const n = Number(v);
  return v === null || v === "" || !Number.isFinite(n) || n < 0 ? null : Math.round(n);
}

async function saveRates(lang: string, formData: FormData) {
  "use server";
  const { shop } = await requireShop(asLocale(lang));
  const allHome = priceOrNull(formData.get("all_home"));
  const allDesk = priceOrNull(formData.get("all_desk"));
  const useAll = formData.get("apply_all") === "1";
  const rows = wilayas.map((w) => ({
    shopId: shop.id,
    wilayaCode: w.code,
    homePrice: useAll ? allHome : priceOrNull(formData.get(`home_${w.code}`)),
    deskPrice: useAll ? allDesk : priceOrNull(formData.get(`desk_${w.code}`)),
  }));
  await db.transaction(async (tx) => {
    await tx.delete(schema.shippingRates).where(eq(schema.shippingRates.shopId, shop.id));
    await tx.insert(schema.shippingRates).values(rows);
  });
  revalidatePath(`/${lang}/dashboard/shipping`);
}

export default async function ShippingPage({ params }: PageProps<"/[lang]/dashboard/shipping">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop } = await requireShop(lang);
  const rates = new Map(
    (await db.select().from(schema.shippingRates).where(eq(schema.shippingRates.shopId, shop.id))).map((r) => [r.wilayaCode, r]),
  );
  const action = saveRates.bind(null, lang);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t.shipping.title}</h1>
      <p className="text-sm text-slate-600">{t.shipping.hint}</p>

      <form action={action} className="card flex flex-wrap items-end gap-3">
        <input type="hidden" name="apply_all" value="1" />
        <div>
          <label className="label">{t.shipping.home}</label>
          <input name="all_home" type="number" min={0} className="input w-32" />
        </div>
        <div>
          <label className="label">{t.shipping.desk}</label>
          <input name="all_desk" type="number" min={0} className="input w-32" />
        </div>
        <button className="btn-outline">{t.shipping.fillAll}</button>
      </form>

      <form action={action} className="card space-y-4 p-0">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>{t.orders.wilaya}</th>
                <th>{t.shipping.home} ({t.common.currency})</th>
                <th>{t.shipping.desk} ({t.common.currency})</th>
              </tr>
            </thead>
            <tbody>
              {wilayas.map((w) => {
                const r = rates.get(w.code);
                return (
                  <tr key={w.code}>
                    <td className="whitespace-nowrap">
                      {String(w.code).padStart(2, "0")} - {lang === "ar" ? w.ar : w.fr}
                    </td>
                    <td>
                      <input name={`home_${w.code}`} type="number" min={0} className="input w-28" defaultValue={r?.homePrice ?? ""} />
                    </td>
                    <td>
                      <input name={`desk_${w.code}`} type="number" min={0} className="input w-28" defaultValue={r?.deskPrice ?? ""} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="p-4 pt-0">
          <button className="btn">{t.common.save}</button>
        </div>
      </form>
    </div>
  );
}
