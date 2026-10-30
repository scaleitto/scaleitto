import type { DeliveryFault, DeliveryState, ProcessingState, ShipmentStatus } from "@/server/db/schema";
import { PARCEL_STATUSES, PENDING_STATUSES, type OrderStatus } from "./statuses";

// The order lists of the Orders section, one per sub-section, each feeding the next:
//   all     = Orders list (Statut de la commande chips, + "suspicious" = still to confirm at or above the risk threshold)
//   ship    = Send to couriers (Injection: confirmed and not injected yet / injected = sent, still on its way)
//   transit = Parcel tracking (every sent parcel, by the courier's stage)
//   returns = Returns (parcels on their way back, returned, received)
export const orderViews = ["all", "risk", "ship", "transit", "returns"] as const;
export type OrderView = (typeof orderViews)[number];
export const isOrderView = (v: unknown): v is OrderView => orderViews.includes(v as OrderView);

// Returns sub-section filter: on the way back, back at the courier (to collect), received
export const returnStates = ["back", "pending", "received"] as const;
export type ReturnState = (typeof returnStates)[number];
// Send to couriers: not injected yet (confirmed, no parcel) / injected (parcel created, on its way)
export const injectionStates = ["pending", "done"] as const;
export type InjectionState = (typeof injectionStates)[number];

// Parcel tracking chips: the courier's stages in the order of the Ecotrack screen, with "returns" grouping the parcels on
// their way back and the returned ones. Names are the courier's own (French) words.
export const trackingStages = ["ready", "pickup", "to_station", "at_station", "to_wilaya", "preparing", "out_for_delivery", "suspended", "delivered", "returns", "deleted", "cancelled", "to_delete"] as const;
export type TrackingStage = (typeof trackingStages)[number];
export const stageNames: Record<TrackingStage, string> = {
  ready: "Prêt à expédier",
  pickup: "En ramassage",
  to_station: "Vers Station",
  at_station: "En Station",
  to_wilaya: "Vers Wilaya",
  preparing: "En preparation",
  out_for_delivery: "En livraison",
  suspended: "Suspendus",
  delivered: "Livrés",
  returns: "Retours",
  deleted: "Colis Supprimés",
  cancelled: "Colis Annulés",
  to_delete: "Colis à supprimer",
};
export const stageShipments = (stage: TrackingStage): ShipmentStatus[] => (stage === "returns" ? ["returning", "returned"] : [stage]);
export const isTrackingStage = (v: unknown): v is TrackingStage => trackingStages.includes(v as TrackingStage);

export const viewStatuses: Record<OrderView, readonly OrderStatus[] | null> = {
  all: null,
  risk: PENDING_STATUSES,
  ship: null,
  transit: PARCEL_STATUSES,
  returns: null,
};

// Rows per page the merchant can choose (bigger pages for bulk sending)
export const pageSizes = [25, 50, 100, 200] as const;

// Filters of the orders lists, read from the address bar
export type OrderFilters = {
  view: OrderView;
  q: string;
  status?: OrderStatus;
  stage?: TrackingStage;
  ret?: ReturnState;
  inj?: InjectionState;
  ds?: DeliveryState;
  fault?: DeliveryFault;
  proc?: ProcessingState;
  fin?: "delivered" | "returned";
  wilaya?: number;
  delivery?: "home" | "office";
  from?: string;
  to?: string;
  assignee?: string;
  page: number;
  size: number;
};
