import { connection } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { db, schema } from "@/server/db";
import { wilayaName } from "@/lib/wilayas";
import { formatDate, formatTime } from "@/lib/format";
import { viewerOf, visibleOrders } from "@/features/orders/access";
import { Manifest } from "@/features/delivery/Manifest";
import { PrintButton } from "@/features/delivery/PrintButton";
import { defaultManifest, resolveManifest } from "@/features/delivery/settings";

const MAX = 300;

// The handover manifest of the selected parcels (orders page → print), with the published template
export default async function PrintManifest({ params, searchParams }: PageProps<"/[lang]/print/manifest">) {
  const lang = asLocale((await params).lang);
  const ctx = await requireSection(lang, "orders");
  await connection();
  const raw = (await searchParams).ids;
  const ids = String(Array.isArray(raw) ? raw[0] : (raw ?? ""))
    .split(",")
    .filter((id) => /^[0-9a-f-]{36}$/.test(id))
    .slice(0, MAX);
  const o = schema.orders;
  const [orders, [shop]] = await Promise.all([
    ids.length
      ? db
          .select({ id: o.id, number: o.number, name: o.customerName, phone: o.phone, wilaya: o.wilayaCode, commune: o.commune, total: o.total, note: o.note, customerNote: o.customerNote, locked: o.locked, carrier: schema.shipments.carrierName, tracking: schema.shipments.trackingNumber })
          .from(o)
          .leftJoin(schema.shipments, eq(schema.shipments.orderId, o.id))
          .where(and(visibleOrders(viewerOf(ctx)), inArray(o.id, ids), eq(o.locked, false)))
          .orderBy(o.number)
      : Promise.resolve([]),
    db.select({ manifest: schema.shops.manifest, name: schema.shops.name, logo: schema.shops.logoUrl }).from(schema.shops).where(eq(schema.shops.id, ctx.shop.id)),
  ]);
  const items = orders.length ? await db.select().from(schema.orderItems).where(and(eq(schema.orderItems.shopId, ctx.shop.id), inArray(schema.orderItems.orderId, orders.map((r) => r.id)))) : [];
  const template = resolveManifest(shop?.manifest).published ?? defaultManifest;
  const carriers = [...new Set(orders.map((r) => r.carrier).filter(Boolean))];
  const now = new Date();
  return (
    <main className="mx-auto max-w-4xl bg-white p-6 print:max-w-none print:p-0">
      <style>{`@page { size: ${template.paper === "a6" ? "A6" : "A4"}; margin: 10mm; } @media print { html, body { background: #fff !important; } }`}</style>
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>
      <Manifest
        template={template}
        store={{ name: shop?.name ?? "", logo: shop?.logo ?? null }}
        carrier={carriers.join(" · ") || "—"}
        date={`${formatDate(now, "fr")} ${formatTime(now, "fr")}`}
        rows={orders.map((r) => ({
          reference: `#${r.number}`,
          tracking: r.tracking ?? "—",
          recipient: r.name,
          phone: r.phone,
          destination: `${r.commune}, ${wilayaName(r.wilaya, template.language === "ar" ? "ar" : "fr")}`,
          cod: r.total,
          items: items.filter((i) => i.orderId === r.id).map((i) => `${i.name}${i.variantTitle ? ` (${i.variantTitle})` : ""} × ${i.quantity}`).join(" + "),
          notes: [r.note, r.customerNote].filter(Boolean).join(" · "),
        }))}
      />
    </main>
  );
}
