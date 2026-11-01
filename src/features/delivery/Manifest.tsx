import { formatPrice } from "@/lib/format";
import type { ManifestTemplate } from "./settings";

// The manifest's own words, in the language chosen in the template (not the dashboard's)
const labels = {
  ar: { order: "الطلب", tracking: "رقم التتبع", recipient: "المستلم", phone: "الهاتف", destination: "الوجهة", cod: "المبلغ", items: "المنتجات", notes: "ملاحظة", parcels: "عدد الطرود", total: "مجموع المبالغ", seller: "توقيع البائع", driver: "توقيع الموزّع", pickup: "تعليمات الاستلام", returns: "سياسة الإرجاع", currency: "د.ج" },
  fr: { order: "Commande", tracking: "Suivi", recipient: "Destinataire", phone: "Téléphone", destination: "Destination", cod: "Montant", items: "Articles", notes: "Note", parcels: "Colis", total: "Total à encaisser", seller: "Signature du vendeur", driver: "Signature du livreur", pickup: "Instructions de ramassage", returns: "Politique de retour", currency: "DA" },
  en: { order: "Order", tracking: "Tracking", recipient: "Recipient", phone: "Phone", destination: "Destination", cod: "COD", items: "Items", notes: "Note", parcels: "Parcels", total: "COD total", seller: "Seller signature", driver: "Driver signature", pickup: "Pickup instructions", returns: "Return policy", currency: "DA" },
};

export type ManifestRow = { reference: string; tracking: string; recipient: string; phone: string; destination: string; cod: number; items: string; notes: string };

// Sample parcels for the editor's preview (never the merchant's real orders)
export const sampleRows: ManifestRow[] = [
  { reference: "#1041", tracking: "TRK-000041", recipient: "Amina B.", phone: "0555 00 00 41", destination: "Bab Ezzouar, Alger", cod: 4500, items: "Lampe × 1", notes: "" },
  { reference: "#1042", tracking: "TRK-000042", recipient: "Yacine K.", phone: "0661 00 00 42", destination: "Es Senia, Oran", cod: 2700, items: "Montre × 2", notes: "Appeler avant" },
];

// The handover manifest: who the parcels went to and what the driver collects, on A4 (a table) or A6 (one card per
// parcel). Plain markup: drawn by the editor preview and by the print page.
export function Manifest({ template: m, store, carrier, date, rows }: { template: ManifestTemplate; store: { name: string; logo: string | null }; carrier: string; date: string; rows: ManifestRow[] }) {
  const l = labels[m.language];
  const cur = l.currency;
  const total = rows.reduce((s, r) => s + r.cod, 0);
  const cols = [
    m.show.reference && { key: "reference", label: l.order },
    { key: "tracking", label: l.tracking },
    { key: "recipient", label: l.recipient },
    m.show.phone && { key: "phone", label: l.phone },
    { key: "destination", label: l.destination },
    m.show.items && { key: "items", label: l.items },
    m.show.notes && { key: "notes", label: l.notes },
    m.show.cod && { key: "cod", label: l.cod },
  ].filter((c): c is { key: keyof ManifestRow; label: string } => Boolean(c));
  const a6 = m.paper === "a6";
  return (
    <div dir={m.direction} lang={m.language} className={`bg-white text-[#0f172a] ${a6 ? "text-[11px]" : "text-xs"}`} data-testid="manifest" data-paper={m.paper}>
      <header className="flex items-start justify-between gap-4 border-b-2 border-[#0f172a] pb-3">
        <div className="flex items-center gap-3">
          {m.logo && store.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logo} alt="" className="h-10 w-auto object-contain" />
          )}
          <div>
            <p className="text-base font-bold">{store.name}</p>
            {m.header && <p className="whitespace-pre-line text-[#475569]">{m.header}</p>}
          </div>
        </div>
        <div className="text-end">
          <p className="font-bold">{carrier}</p>
          <p className="text-[#475569] tabular-nums" dir="ltr">
            {date}
          </p>
        </div>
      </header>

      {a6 ? (
        <div className="mt-3 space-y-2">
          {rows.map((r) => (
            <div key={r.tracking} className="rounded border border-[#cbd5e1] p-2" data-row>
              {cols.map((c) => (
                <p key={c.key} className="flex justify-between gap-2">
                  <span className="text-[#64748b]">{c.label}</span>
                  <span className="font-semibold">{c.key === "cod" ? formatPrice(r.cod, cur) : r[c.key]}</span>
                </p>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr className="bg-[#f1f5f9]">
              {cols.map((c) => (
                <th key={c.key} className="border border-[#cbd5e1] px-2 py-1.5 text-start font-semibold">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.tracking} data-row>
                {cols.map((c) => (
                  <td key={c.key} className={`border border-[#cbd5e1] px-2 py-1.5 ${c.key === "cod" || c.key === "phone" || c.key === "tracking" ? "whitespace-nowrap tabular-nums" : ""}`}>
                    {c.key === "cod" ? formatPrice(r.cod, cur) : r[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-3 flex justify-between gap-4 font-bold">
        <span data-testid="manifest-count">
          {l.parcels}: {rows.length}
        </span>
        {m.show.cod && (
          <span>
            {l.total}: {formatPrice(total, cur)}
          </span>
        )}
      </div>

      {(m.pickup || m.returns) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {m.pickup && (
            <div>
              <p className="font-bold">{l.pickup}</p>
              <p className="whitespace-pre-line text-[#475569]">{m.pickup}</p>
            </div>
          )}
          {m.returns && (
            <div>
              <p className="font-bold">{l.returns}</p>
              <p className="whitespace-pre-line text-[#475569]">{m.returns}</p>
            </div>
          )}
        </div>
      )}

      {m.show.signatures && (
        <div className="mt-8 grid grid-cols-2 gap-8">
          {[l.seller, l.driver].map((s) => (
            <div key={s} className="border-t border-[#0f172a] pt-1 text-center text-[#475569]">
              {s}
            </div>
          ))}
        </div>
      )}
      {m.footer && <p className="mt-6 border-t border-[#cbd5e1] pt-2 text-center whitespace-pre-line text-[#64748b]">{m.footer}</p>}
    </div>
  );
}
