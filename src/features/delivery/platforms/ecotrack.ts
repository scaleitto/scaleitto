import "server-only";
import { CarrierError, messageOf, request, type CarrierClient, type Credentials, type ParcelInput } from "./types";

// Ecotrack platform (DHD, Anderson, 48Hr, Navex…): one Bearer token on the courier's own domain.
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
      const body = {
        reference: p.reference,
        nom_client: p.fullName,
        telephone: p.phone,
        adresse: p.address || p.commune,
        commune: p.commune,
        code_wilaya: p.wilayaCode,
        montant: p.codAmount,
        remarque: p.note || undefined,
        produit: p.products.slice(0, 255),
        type: 1, // 1 = delivery
        stop_desk: p.stopDesk ? 1 : 0,
      };
      const { status, data } = await request(`${baseUrl}/api/v1/create/order`, { method: "POST", headers, body });
      const d = data as { success?: boolean; tracking?: string; message?: string };
      if (status >= 400 || d?.success === false || !d?.tracking) throw new CarrierError(messageOf(data, `HTTP ${status}`));
      return { trackingNumber: d.tracking, labelUrl: null };
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
