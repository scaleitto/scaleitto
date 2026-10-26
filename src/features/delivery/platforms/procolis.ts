import "server-only";
import { CarrierError, messageOf, request, type CarrierClient, type Credentials, type ParcelInput } from "./types";

// Procolis (ZR Express): headers token + key, parcels sent as { Colis: [...] }.
export function procolisClient(baseUrl: string, creds: Credentials): CarrierClient {
  const headers = { token: creds.token ?? "", key: creds.key ?? "" };
  return {
    async test() {
      const { status, data } = await request(`${baseUrl}/api_v1/token`, { headers });
      if (status === 401 || status === 403) return false;
      if (status !== 200) throw new CarrierError(`HTTP ${status}`);
      return String((data as { Statut?: string }).Statut ?? "").toLowerCase().includes("activ");
    },

    async createParcel(p: ParcelInput) {
      const colis = {
        Tracking: p.reference,
        TypeLivraison: p.stopDesk ? "1" : "0", // 0 = home, 1 = stop desk
        TypeColis: "0",
        Confrimee: "", // (sic) the courier's own spelling
        Client: p.fullName,
        MobileA: p.phone,
        MobileB: "",
        Adresse: p.address || p.commune,
        IDWilaya: String(p.wilayaCode).padStart(2, "0"),
        Commune: p.commune,
        Total: String(p.codAmount),
        Note: p.note,
        TProduit: p.products,
        id_Externe: p.reference,
        Source: "Scaleitto",
      };
      const { status, data } = await request(`${baseUrl}/api_v1/add_colis`, { method: "POST", headers, body: { Colis: [colis] } });
      const result = (data as { Colis?: { MessageRetour?: string; Tracking?: string }[] }).Colis?.[0];
      if (status >= 400 || !result || result.MessageRetour !== "Good") throw new CarrierError(result?.MessageRetour || messageOf(data, `HTTP ${status}`));
      return { trackingNumber: result.Tracking || p.reference, labelUrl: null };
    },

    async trackingStatus(tracking) {
      const { status, data } = await request(`${baseUrl}/api_v1/lire`, { method: "POST", headers, body: { Colis: [{ Tracking: tracking }] } });
      if (status !== 200) return null;
      const row = (data as { Colis?: Record<string, string>[] }).Colis?.[0];
      return row?.Situation ?? row?.Statut ?? row?.status ?? null;
    },
  };
}
