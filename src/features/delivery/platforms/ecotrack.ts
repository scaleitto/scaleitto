import "server-only";
import { CarrierError, messageOf, request, type CarrierClient, type Credentials, type ParcelInput } from "./types";

// Operation type: 1 delivery, 2 exchange, 3 pick up, 4 recovery (recouvrement)
const KIND: Record<ParcelInput["kind"], number> = { delivery: 1, exchange: 2, pickup: 3, recovery: 4 };

// Ecotrack platform (Packers, DHD, Anderson, 48Hr, Navex…): one Bearer token on the courier's own domain.
export function ecotrackClient(baseUrl: string, creds: Credentials): CarrierClient {
  const headers = { Authorization: `Bearer ${creds.token ?? ""}` };
  return {
    async test() {
      const { status } = await request(`${baseUrl}/api/v1/get/wilayas`, { headers });
      if (status === 200) return true;
      if (status === 401 || status === 403) return false;
      throw new CarrierError(`HTTP ${status}`);
    },

    async createParcel(p: ParcelInput) {
      // Field names from the Ecotrack API (as used by the open-source CourierDZ client)
      const body = {
        reference: p.reference,
        nom_client: p.fullName,
        telephone: p.phone,
        telephone_2: p.phone2 || undefined,
        adresse: p.address || p.commune,
        commune: p.commune,
        code_wilaya: p.wilayaCode,
        montant: p.codAmount,
        remarque: p.note.slice(0, 255) || undefined,
        produit: p.products.slice(0, 255),
        type: KIND[p.kind],
        stop_desk: p.stopDesk ? 1 : 0,
        produit_a_recupere: p.kind === "exchange" && p.itemToCollect ? p.itemToCollect.slice(0, 255) : undefined,
      };
      const { status, data } = await request(`${baseUrl}/api/v1/create/order`, { method: "POST", headers, body });
      const d = data as { success?: boolean; tracking?: string; message?: string };
      if (status >= 400 || d?.success === false || !d?.tracking) throw new CarrierError(messageOf(data, `HTTP ${status}`));
      return { trackingNumber: d.tracking, labelUrl: null };
    },

    // The label is a PDF served by the courier (the token cannot be put in a link, so we fetch it for the merchant)
    async label(tracking) {
      const res = await fetch(`${baseUrl}/api/v1/get/order/label?tracking=${encodeURIComponent(tracking)}`, { headers, signal: AbortSignal.timeout(20_000), redirect: "error" });
      if (res.status !== 200) return null;
      const body = await res.arrayBuffer();
      return body.byteLength ? { body, contentType: res.headers.get("content-type") || "application/pdf" } : null;
    },

    async trackingStatus(tracking) {
      const { status, data } = await request(`${baseUrl}/api/v1/get/tracking/info?tracking=${encodeURIComponent(tracking)}`, { headers });
      if (status !== 200 || !data || typeof data !== "object") return null;
      const d = data as { activity?: { status?: string; event?: string }[]; status?: string; current_status?: string };
      const last = Array.isArray(d.activity) && d.activity.length ? d.activity[d.activity.length - 1] : null;
      return last?.status ?? last?.event ?? d.current_status ?? d.status ?? null;
    },
  };
}
