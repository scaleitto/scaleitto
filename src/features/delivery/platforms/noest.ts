import "server-only";
import { CarrierError, messageOf, request, type CarrierClient, type Credentials, type ParcelInput } from "./types";

// NOEST: api_token + user_guid in the body. A created order is a draft until it is validated,
// so we validate right after creating it (otherwise no pickup is ever scheduled).
export function noestClient(baseUrl: string, creds: Credentials): CarrierClient {
  const auth = { api_token: creds.apiToken ?? "", user_guid: creds.userGuid ?? "" };
  return {
    async test() {
      const { status } = await request(`${baseUrl}/api/public/fees?${new URLSearchParams(auth)}`);
      if (status === 200) return true;
      if (status === 401 || status === 403 || status === 422) return false;
      throw new CarrierError(`HTTP ${status}`);
    },

    async createParcel(p: ParcelInput) {
      const body = {
        ...auth,
        reference: p.reference,
        client: p.fullName,
        phone: p.phone,
        adresse: p.address || p.commune,
        wilaya_id: p.wilayaCode,
        commune: p.commune,
        montant: p.codAmount,
        remarque: p.note,
        produit: p.products,
        type_id: 1, // 1 = delivery
        poids: 1,
        stop_desk: p.stopDesk ? 1 : 0,
        ...(p.stopDesk ? { station_code: `${p.wilayaCode}A` } : {}),
        stock: 0,
      };
      const { status, data } = await request(`${baseUrl}/api/public/create/order`, { method: "POST", body });
      const d = data as { success?: boolean; tracking?: string };
      if (status >= 400 || !d?.success || !d.tracking) throw new CarrierError(messageOf(data, `HTTP ${status}`));
      const valid = await request(`${baseUrl}/api/public/valid/order`, { method: "POST", body: { ...auth, tracking: d.tracking } });
      if (valid.status >= 400) throw new CarrierError(`Created as draft (${d.tracking}) but not validated: ${messageOf(valid.data, `HTTP ${valid.status}`)}`);
      return { trackingNumber: d.tracking, labelUrl: null };
    },

    async trackingStatus(tracking) {
      const { status, data } = await request(`${baseUrl}/api/public/get/trackings/info`, { method: "POST", body: { ...auth, trackings: [tracking] } });
      if (status !== 200 || !data || typeof data !== "object") return null;
      const info = (data as Record<string, { activity?: { event?: string; status?: string }[] }>)[tracking];
      const events = (info?.activity ?? []).filter((a) => !/paiement|payment|versement/i.test(a.event ?? ""));
      const last = events[events.length - 1];
      return last?.event ?? last?.status ?? null;
    },
  };
}
