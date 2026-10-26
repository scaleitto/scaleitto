import type { OrderStatus, ShipmentStatus } from "@/server/db/schema";

// Couriers describe parcels in their own words (French, Arabic, codes). This maps them
// to one set of statuses. Unknown wording stays visible as the raw status.
const rules: [RegExp, ShipmentStatus][] = [
  [/annul|cancel|ملغ/i, "cancelled"],
  [/retour.*(en cours|transit|vers)|en retour|returning|retour en/i, "returning"],
  [/retourn|retour|returned|مرتجع|إرجاع/i, "returned"],
  [/tentative|échou|echou|absent|injoignable|report|refus|attempt|محاولة/i, "attempted"],
  [/en cours de livraison|sorti en livraison|out for delivery|خرج/i, "out_for_delivery"],
  [/livr[ée]|delivered|تم التسليم|encaiss/i, "delivered"],
  [/transit|transf|exp[ée]di|enlev|ramass|re[çc]u|centre|hub|agence|stop ?desk|picked|shipped|قيد/i, "in_transit"],
  [/pr[ée]paration|attente|cr[ée]{1,2}|enregistr|pending|prêt|pret|created/i, "created"],
];

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
