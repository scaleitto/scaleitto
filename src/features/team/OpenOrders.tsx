import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt, formatDate } from "@/lib/format";
import { wilayaName } from "@/lib/wilayas";
import { Badge, Card } from "@/ui";
import { BulkAssignBar, SelectAllOrders } from "@/features/orders/BulkAssign";
import { statusTone, type OrderStatus } from "@/features/orders/statuses";

type Row = { id: string; number: number; customerName: string; phone: string; wilayaCode: number; status: OrderStatus; callAttempts: number; assigneeName: string | null; createdAt: Date };

// Call centers → distribution: the orders still to confirm, to hand out by hand (to one member, or shared between agents).
// The only place orders are distributed (the automatic rule is above it).
export function OpenOrders({ lang, rows, members, orderBase, t }: { lang: string; rows: Row[]; members: { userId: string; name: string; role: string }[]; orderBase: string; t: Dictionary }) {
  const o = t.orders;
  return (
    <Card className="mt-6 p-0" data-testid="open-orders">
      <div className="border-b border-line p-4">
        <h2 className="font-semibold">{t.team.openOrders}</h2>
        <p className="mt-0.5 text-xs text-muted">{t.team.openOrdersHint}</p>
      </div>
      {rows.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted">{o.noResults}</p>
      ) : (
        <>
          <BulkAssignBar lang={lang} members={members} t={{ orders: t.orders, errors: t.errors }} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="w-10 p-3">
                    <SelectAllOrders label={o.bulk.selectAll} />
                  </th>
                  <th className="p-3 text-start font-medium">{o.columns.order}</th>
                  <th className="p-3 text-start font-medium">{o.columns.customer}</th>
                  <th className="hidden p-3 text-start font-medium md:table-cell">{o.columns.wilaya}</th>
                  <th className="p-3 text-start font-medium">{o.columns.status}</th>
                  <th className="p-3 text-start font-medium">{o.columns.assignee}</th>
                  <th className="hidden p-3 text-start font-medium sm:table-cell">{o.columns.date}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0" data-order={r.number}>
                    <td className="p-3">
                      <input type="checkbox" data-bulk-order data-number={r.number} value={r.id} aria-label={`${o.bulk.select} #${r.number}`} className="size-4 accent-[var(--color-accent)]" />
                    </td>
                    <td className="p-3 font-bold">
                      <a href={`${orderBase}/${r.id}`} className="hover:underline">
                        #{r.number}
                      </a>
                    </td>
                    <td className="p-3">
                      <span className="block font-semibold">{r.customerName}</span>
                      <span className="block text-xs text-muted" dir="ltr">
                        {r.phone}
                      </span>
                    </td>
                    <td className="hidden p-3 text-muted md:table-cell">{wilayaName(r.wilayaCode, lang)}</td>
                    <td className="p-3">
                      <Badge tone={statusTone[r.status]}>{o.statuses[r.status]}</Badge>
                      {r.callAttempts > 0 && <span className="ms-1 text-[11px] text-muted">{fmt(o.model.calls, { n: r.callAttempts })}</span>}
                    </td>
                    <td className="p-3 text-muted">{r.assigneeName ?? o.unassigned}</td>
                    <td className="hidden p-3 text-xs whitespace-nowrap text-muted sm:table-cell">{formatDate(r.createdAt, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
