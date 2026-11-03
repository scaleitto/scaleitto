import "server-only";
import { after } from "next/server";
import { and, asc, eq, inArray, lt, lte, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { newId } from "@/server/auth/context";
import { logError } from "@/server/errors";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { formatPrice } from "@/lib/format";
import { algeriaParts } from "@/lib/time";
import { inQuietHours, resolveApps, type WhatsAppSettings } from "@/features/apps/settings";
import { CREDIT_COSTS } from "@/features/credits/packs";
import { grantCredits, spendCredits } from "@/features/credits/ledger";
import { PENDING_STATUSES } from "@/features/orders/statuses";
import { sendTemplate, templatePrefix, whatsappConfigured } from "./cloud";
import { laterStatus, readReply, replyPayload, templateName, templateParams, waPhone, type WaKind } from "./messages";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const m = schema.whatsappMessages;
const isQuestion = (kind: WaKind) => kind === "confirm" || kind === "reminder";
// The reminder goes out when the question has not been read for this long
export const REMINDER_HOURS = 4;
// A message being sent is held this long, so the cron and the request that queued it never send it twice
const LEASE_MINUTES = 10;

// Does the store send this message for this order? (the switch, the notice's own switch, the chosen products)
async function wanted(c: Tx | typeof db, shopId: string, orderId: string, kind: WaKind, wa: WhatsAppSettings) {
  if (kind === "confirm" || kind === "reminder") {
    if (!wa.enabled) return false;
    if (kind === "reminder" && !wa.reminder) return false;
    if (wa.products) {
      if (!wa.products.length) return false;
      const [hit] = await c
        .select({ id: schema.orderItems.id })
        .from(schema.orderItems)
        .where(and(eq(schema.orderItems.shopId, shopId), eq(schema.orderItems.orderId, orderId), inArray(schema.orderItems.productId, wa.products)))
        .limit(1);
      return Boolean(hit);
    }
    return true;
  }
  return wa.notify[kind];
}

// Queues one message for an order (once per kind) and sends it right after the response. Nothing happens when the
// platform's number is not set up or the store does not want this message. tx: inside the caller's transaction.
export async function scheduleWhatsApp(shopId: string, orderId: string, kind: WaKind, tx?: Tx) {
  if (!whatsappConfigured()) return;
  try {
    const c = tx ?? db;
    const [shop] = await c.select({ apps: schema.shops.apps }).from(schema.shops).where(eq(schema.shops.id, shopId));
    if (!shop || !(await wanted(c, shopId, orderId, kind, resolveApps(shop.apps).whatsapp))) return;
    const res = await c
      .insert(m)
      .values({ id: newId(), shopId, orderId, kind, dueAt: new Date() })
      .onDuplicateKeyUpdate({ set: { id: sql`id` } });
    if (!res[0].affectedRows) return;
  } catch (err) {
    await logError("whatsapp/queue", err);
    return;
  }
  const run = () => processWhatsApp({ shopId }).catch((err) => logError("whatsapp/run", err));
  try {
    after(run);
  } catch {
    void run();
  }
}

// The notice a parcel's new stage asks for (the delivery company's report)
export function stageNotice(stage: string, deliveryType: "home" | "office"): WaKind | null {
  if (stage === "out_for_delivery") return "out_for_delivery";
  if (stage === "suspended") return "failed_attempt";
  if (stage === "at_station" && deliveryType === "office") return "at_desk";
  return null;
}

type Row = typeof m.$inferSelect;

// Sends one queued message: skipped when the order no longer needs it or the balance is empty, held during the quiet
// hours, paid before it leaves and refunded when Meta refuses it.
async function deliver(row: Row) {
  const [order] = await db.select().from(schema.orders).where(and(eq(schema.orders.shopId, row.shopId), eq(schema.orders.id, row.orderId)));
  const [shop] = await db.select({ name: schema.shops.name, apps: schema.shops.apps, locale: schema.shops.defaultLocale }).from(schema.shops).where(eq(schema.shops.id, row.shopId));
  const skip = (error: string) => db.update(m).set({ status: "skipped", error }).where(eq(m.id, row.id));
  // Over the plan's limit: the customer's details never leave the server
  if (!order || !shop || order.locked) return skip(order?.locked ? "locked" : "gone");
  const wa = resolveApps(shop.apps).whatsapp;
  const question = isQuestion(row.kind);
  if (question && (!(PENDING_STATUSES as readonly string[]).includes(order.status) || order.whatsapp === "confirmed" || order.whatsapp === "cancelled")) return skip("answered");
  if (!(await wanted(db, row.shopId, row.orderId, row.kind, wa))) return skip("off");
  const to = waPhone(order.phone);
  if (!to) return skip("phone");
  // Quiet hours: it waits (the next run after the window closes sends it)
  if (inQuietHours(wa, Math.floor(algeriaParts(new Date()).minutes / 60))) return db.update(m).set({ dueAt: new Date(Date.now() + 15 * 60_000) }).where(eq(m.id, row.id));

  const cost = question ? CREDIT_COSTS.whatsapp : CREDIT_COSTS.notification;
  const kind = question ? "whatsapp" : "notification";
  if (!(await spendCredits(row.shopId, cost, kind, `#${order.number} · ${row.kind}`))) return skip("balance");

  const lang = wa.language || (isLocale(shop.locale) ? shop.locale : "ar");
  const [items, [shipment]] = await Promise.all([
    db.select({ name: schema.orderItems.name, quantity: schema.orderItems.quantity }).from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id)),
    db.select({ tracking: schema.shipments.trackingNumber }).from(schema.shipments).where(eq(schema.shipments.orderId, order.id)).limit(1),
  ]);
  const params = templateParams(row.kind, {
    customerName: order.customerName,
    shopName: shop.name,
    number: order.number,
    products: items.map((i) => `${i.name} × ${i.quantity}`).join("، "),
    total: formatPrice(order.total, getDictionary(lang).common.currency),
    tracking: shipment?.tracking ?? null,
  });
  const buttons = question ? [replyPayload("confirm", order.id), replyPayload("cancel", order.id)] : [];
  const sent = await sendTemplate(to, templateName(row.kind, templatePrefix()), lang, params, buttons);
  if (!sent.ok) {
    await grantCredits(row.shopId, cost, "refund", `#${order.number} · ${row.kind}`);
    return db.update(m).set({ status: "failed", error: sent.error }).where(eq(m.id, row.id));
  }
  await db.update(m).set({ status: "sent", wamid: sent.id, credits: cost, sentAt: new Date(), error: null }).where(eq(m.id, row.id));
  if (row.kind === "confirm") await db.update(schema.orders).set({ whatsapp: "waiting" }).where(and(eq(schema.orders.id, order.id), sql`${schema.orders.whatsapp} is null`));
}

// Sends the messages that are due (one shop right after a response, every shop from the cron)
export async function processWhatsApp({ shopId, limit = 50, budgetMs = 20_000 }: { shopId?: string; limit?: number; budgetMs?: number } = {}) {
  if (!whatsappConfigured()) return { due: 0, sent: 0 };
  const started = Date.now();
  const due = await db
    .select()
    .from(m)
    .where(and(eq(m.status, "queued"), lte(m.dueAt, new Date()), shopId ? eq(m.shopId, shopId) : undefined))
    .orderBy(asc(m.dueAt))
    .limit(limit);
  let sent = 0;
  for (const row of due) {
    if (Date.now() - started > budgetMs) break;
    // Claim it: whoever moves its due time first sends it
    const [claim] = await db
      .update(m)
      .set({ dueAt: new Date(Date.now() + LEASE_MINUTES * 60_000) })
      .where(and(eq(m.id, row.id), eq(m.status, "queued"), lte(m.dueAt, new Date())));
    if (!claim.affectedRows) continue;
    try {
      await deliver(row);
      sent++;
    } catch (err) {
      await logError("whatsapp/send", err);
    }
  }
  return { due: due.length, sent };
}

// Cron: one reminder for each question still unread after REMINDER_HOURS, while the order waits for an answer
export async function queueReminders() {
  if (!whatsappConfigured()) return 0;
  const r = schema.whatsappMessages;
  const rows = await db
    .select({ shopId: r.shopId, orderId: r.orderId })
    .from(r)
    .innerJoin(schema.orders, eq(schema.orders.id, r.orderId))
    .where(
      and(
        eq(r.kind, "confirm"),
        inArray(r.status, ["sent", "delivered"]),
        lt(r.sentAt, new Date(Date.now() - REMINDER_HOURS * 3600_000)),
        eq(schema.orders.whatsapp, "waiting"),
        inArray(schema.orders.status, [...PENDING_STATUSES]),
        sql`not exists (select 1 from whatsapp_messages x where x.order_id = ${r.orderId} and x.kind = 'reminder')`,
      ),
    )
    .limit(200);
  for (const row of rows) await scheduleWhatsApp(row.shopId, row.orderId, "reminder");
  return rows.length;
}

type Hook = {
  entry?: { changes?: { value?: { statuses?: { id: string; status: string; errors?: { title?: string; message?: string }[] }[]; messages?: { from: string; type: string; button?: { payload?: string }; interactive?: { button_reply?: { id?: string } } }[] } }[] }[];
};

// Meta's webhook: delivery reports (sent / delivered / read / failed → refund) and the buyers' button replies
export async function receiveWhatsApp(payload: Hook) {
  for (const change of payload.entry?.flatMap((e) => e.changes ?? []) ?? []) {
    for (const st of change.value?.statuses ?? []) {
      const [row] = await db.select().from(m).where(eq(m.wamid, String(st.id).slice(0, 128))).limit(1);
      if (!row || row.status === "failed") continue;
      if (st.status === "failed") {
        // Accepted by Meta but never delivered (not on WhatsApp, blocked…): the credits come back
        const [done] = await db.update(m).set({ status: "failed", error: (st.errors?.[0]?.message ?? st.errors?.[0]?.title ?? "failed").slice(0, 200) }).where(and(eq(m.id, row.id), sql`${m.status} <> 'failed'`));
        if (done.affectedRows && row.credits) await grantCredits(row.shopId, row.credits, "refund", `WhatsApp · ${row.kind}`);
        if (row.kind === "confirm") await db.update(schema.orders).set({ whatsapp: null }).where(and(eq(schema.orders.id, row.orderId), eq(schema.orders.whatsapp, "waiting")));
        continue;
      }
      const next = laterStatus(row.status, st.status);
      if (next) await db.update(m).set({ status: next, ...(next === "read" ? { readAt: new Date() } : {}) }).where(eq(m.id, row.id));
    }
    for (const msg of change.value?.messages ?? []) {
      const reply = readReply(msg.button?.payload ?? msg.interactive?.button_reply?.id ?? "");
      if (!reply) continue;
      const [order] = await db.select({ id: schema.orders.id, shopId: schema.orders.shopId, phone: schema.orders.phone, whatsapp: schema.orders.whatsapp }).from(schema.orders).where(eq(schema.orders.id, reply.orderId));
      // Only the buyer the question went to can answer it
      if (!order || !order.whatsapp || waPhone(order.phone) !== String(msg.from).replace(/\D/g, "")) continue;
      await db.transaction(async (tx) => {
        await tx.update(schema.orders).set({ whatsapp: reply.answer }).where(eq(schema.orders.id, order.id));
        await tx.update(m).set({ status: "read", readAt: new Date() }).where(and(eq(m.orderId, order.id), inArray(m.kind, ["confirm", "reminder"]), inArray(m.status, ["sent", "delivered"])));
        await tx.insert(schema.orderEvents).values({ id: newId(), orderId: order.id, shopId: order.shopId, type: "message", note: `WhatsApp: ${reply.answer}` });
      });
    }
  }
}
