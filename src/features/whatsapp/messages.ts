// WhatsApp confirmation — the pure part (unit-tested): which Meta template each message uses, its variables, the buyer's
// number in international form and the replies read from the buttons.
import type { schema } from "@/server/db";

export type WaKind = (typeof schema.whatsappKinds)[number];

// Template names approved in the platform's WhatsApp Business account: <prefix><kind> (docs/whatsapp.md has the texts)
export const templateName = (kind: WaKind, prefix = "scaleitto_") => `${prefix}${kind}`;

// Body variables. Questions (confirm, reminder): name, store, order number, products, total. Notices: name, store,
// order number, tracking number. Meta refuses an empty variable, so a missing value becomes "—".
export function templateParams(
  kind: WaKind,
  o: { customerName: string; shopName: string; number: number; products: string; total: string; tracking: string | null },
) {
  const v = (s: string | null) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, 200) || "—";
  const base = [v(o.customerName), v(o.shopName), `#${o.number}`];
  return kind === "confirm" || kind === "reminder" ? [...base, v(o.products), v(o.total)] : [...base, v(o.tracking)];
}

// 0555 12 34 56 / +213 555… / 00213… → 213555123456 (null when it is not an Algerian mobile number)
export function waPhone(phone: string) {
  const d = phone.replace(/\D/g, "").replace(/^00/, "");
  const local = d.startsWith("213") ? d.slice(3) : d.replace(/^0/, "");
  return /^[5-7]\d{8}$/.test(local) ? `213${local}` : null;
}

// The quick-reply buttons carry the answer and the order: "confirm:<id>" / "cancel:<id>"
export const replyPayload = (answer: "confirm" | "cancel", orderId: string) => `${answer}:${orderId}`;
export function readReply(payload: string): { answer: "confirmed" | "cancelled"; orderId: string } | null {
  const m = /^(confirm|cancel):([\w-]{1,36})$/.exec(payload.trim());
  return m ? { answer: m[1] === "confirm" ? "confirmed" : "cancelled", orderId: m[2] } : null;
}

// Meta's delivery report never goes backwards (a late "delivered" after "read" is ignored)
const rank = { queued: 0, sent: 1, delivered: 2, read: 3 } as const;
export function laterStatus(current: string, reported: string): "sent" | "delivered" | "read" | null {
  if (!(reported in rank) || reported === "queued" || !(current in rank)) return null;
  return rank[reported as keyof typeof rank] > rank[current as keyof typeof rank] ? (reported as "sent" | "delivered" | "read") : null;
}
