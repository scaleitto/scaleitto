import "server-only";
import { CarrierError, messageOf, request, type CarrierClient, type Credentials, type ParcelInput } from "./types";

// Yalidine API (also Yalitec, Guepex): headers X-API-ID / X-API-TOKEN, parcels created as a list.
export function yalidineClient(baseUrl: string, creds: Credentials): CarrierClient {
  const headers = { "X-API-ID": creds.apiId ?? "", "X-API-TOKEN": creds.apiToken ?? "" };

  async function firstDesk(wilayaCode: number) {
    const { status, data } = await request(`${baseUrl}/v1/centers/?wilaya_id=${wilayaCode}`, { headers });
    const list = status === 200 && Array.isArray((data as { data?: unknown[] }).data) ? (data as { data: { center_id: number }[] }).data : [];
    if (!list.length) throw new CarrierError(`No stop desk in wilaya ${wilayaCode}`);
    return list[0].center_id;
  }

  return {
    async test() {
      const { status } = await request(`${baseUrl}/v1/wilayas/`, { headers });
      if (status === 200) return true;
      if (status === 401 || status === 403) return false;
      throw new CarrierError(`HTTP ${status}`);
    },

    async createParcel(p: ParcelInput) {
      const parcel = {
        order_id: p.reference,
        from_wilaya_name: p.originWilayaName,
        firstname: p.firstName,
        familyname: p.lastName,
        contact_phone: p.phone,
        address: p.address || p.commune,
        to_commune_name: p.commune,
        to_wilaya_name: p.wilayaName,
        product_list: p.products,
        // The customer pays exactly the total they were quoted; Yalidine's fee is taken from it.
        price: p.codAmount,
        do_insurance: false,
        declared_value: p.codAmount,
        length: 0,
        width: 0,
        height: 0,
        weight: p.weight ?? 0,
        freeshipping: true,
        is_stopdesk: p.stopDesk,
        ...(p.stopDesk ? { stopdesk_id: await firstDesk(p.wilayaCode) } : {}),
        has_exchange: p.kind === "exchange",
        ...(p.kind === "exchange" && p.itemToCollect ? { product_to_collect: p.itemToCollect } : {}),
      };
      const { status, data } = await request(`${baseUrl}/v1/parcels/`, { method: "POST", headers, body: [parcel] });
      const result = (data as Record<string, { success?: boolean | string; tracking?: string; label?: string; message?: string }>)[p.reference];
      if (status >= 400 || !result || String(result.success) !== "true" || !result.tracking) throw new CarrierError(result?.message || messageOf(data, `HTTP ${status}`));
      return { trackingNumber: result.tracking, labelUrl: result.label ?? null };
    },

    async trackingStatus(tracking) {
      const { status, data } = await request(`${baseUrl}/v1/parcels/${encodeURIComponent(tracking)}`, { headers });
      if (status !== 200) return null;
      const row = Array.isArray((data as { data?: unknown[] }).data) ? (data as { data: Record<string, unknown>[] }).data[0] : (data as Record<string, unknown>);
      return (row?.last_status as string) ?? (row?.status as string) ?? null;
    },
  };
}
