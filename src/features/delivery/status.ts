import type { OrderStatus, ShipmentStatus } from "@/server/db/schema";

// Couriers describe parcels in their own words (French, Arabic, codes). This maps them to the Ecotrack stages
// (the reference: Packers, DHD…), checked in this order (the first match wins). Unknown wording stays visible as the raw status.
const rules: [RegExp, ShipmentStatus][] = [
  [/[àa] supprimer|to delete/i, "to_delete"],
  [/supprim|deleted|محذوف/i, "deleted"],
  [/annul|cancel|ملغ/i, "cancelled"],
  [/pr[eê]te? [àa] exp[ée]dier|ready to ship/i, "ready"],
  [/retour.*(en cours|transit|vers|chez|traitement)|en retour|returning|in return|retour en/i, "returning"],
  [/retourn|retour|returned|مرتجع|إرجاع/i, "returned"],
  [/suspend|tentative|[ée]chou|[ée]chec|failed|absent|injoignable|report|refus|attempt|محاولة|معلق/i, "suspended"],
  [/en cours de livraison|sortie? en livraison|en livraison|out for delivery|خرج/i, "out_for_delivery"],
  [/livr[ée]|delivered|تم التسليم|encaiss|pay[ée]/i, "delivered"],
  [/pr[ée]paration|preparing/i, "preparing"],
  [/vers (la )?station|to station/i, "to_station"],
  [/vers (la )?wilaya|to wilaya|transit|transf|exp[ée]di|dispatch|shipped|en route/i, "to_wilaya"],
  [/station|centre|hub|agence|entrep[oô]t|bureau|re[çc]u|stop ?desk|قيد/i, "at_station"],
  [/ramass|pick ?up|picked|enlev|collect/i, "pickup"],
  [/pr[eê]t|ready|commande re[çc]ue|order received|attente|cr[ée]{1,2}|enregistr|pending|created|valid/i, "ready"],
];

// Badge colors per stage in the dashboard
export const shipmentTone: Record<ShipmentStatus, "neutral" | "accent" | "warning" | "danger" | "info"> = {
  ready: "neutral",
  pickup: "info",
  to_station: "info",
  at_station: "info",
  to_wilaya: "info",
  preparing: "info",
  out_for_delivery: "info",
  suspended: "warning",
  delivered: "accent",
  returning: "warning",
  returned: "danger",
  cancelled: "danger",
  deleted: "danger",
  to_delete: "warning",
  unknown: "neutral",
};

// Stages where nothing will change any more (tracking stops asking)
export const finalShipmentStatuses: ShipmentStatus[] = ["delivered", "returned", "cancelled", "deleted"];

export function normalizeShipmentStatus(raw: string | null | undefined): ShipmentStatus {
  const text = (raw ?? "").trim();
  if (!text) return "unknown";
  return rules.find(([re]) => re.test(text))?.[1] ?? "unknown";
}

// What the order becomes when its parcel reaches a final state.
export function orderStatusFor(status: ShipmentStatus): OrderStatus | null {
  if (status === "delivered") return "delivered";
  if (status === "returned") return "returned";
  return null;
}

// Split "Mohamed Amine Benali" into the first/last names couriers ask for.
export function splitName(full: string) {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

// "Béjaïa", "BEJAIA", "Bejaia " → "bejaia"
export const nameKey = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, "");
// "en_retour" → "en retour", "OutForDelivery" → "Out For Delivery" (readable, and understood by normalizeShipmentStatus)
export const readableState = (v: string) =>
  v
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
