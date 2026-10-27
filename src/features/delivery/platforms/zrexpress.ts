import "server-only";
import { normalizePhone } from "@/lib/phone";
import { nameKey, readableState } from "../status";
import { CarrierError, messageOf, request, type CarrierClient, type Credentials, type ParcelInput } from "./types";

// ZR Express's new platform (api.zrexpress.app, v1) — not the old Procolis API. Headers X-Tenant + X-Api-Key.
// Addresses are territory UUIDs: the wilaya is found by its code, the commune by its name (ZR writes names
// without accents), stop desks are the wilaya's pickup-point hubs. Creating returns only the parcel id;
// the tracking number comes from reading the parcel back.
type Territory = { id: string; name: string; code?: number | string | null; parentId?: string | null };
type Page<T> = { items?: T[]; hasNext?: boolean };
type Hub = { id: string; isPickupPoint?: boolean; address?: { cityTerritoryId?: string; districtTerritoryId?: string } };
type ZrParcel = { id?: string; trackingNumber?: string; state?: { name?: string; description?: string } };

const MAX_PAGES = 10;
export function zrexpressClient(baseUrl: string, creds: Credentials): CarrierClient {
  const headers = { "X-Tenant": creds.tenantId ?? "", "X-Api-Key": creds.apiKey ?? "" };
  const api = `${baseUrl}/api/v1`;

  async function search<T>(path: string, filters: { field: string; operator: "eq"; value: unknown }[]) {
    const all: T[] = [];
    for (let pageNumber = 1; pageNumber <= MAX_PAGES; pageNumber++) {
      const { status, data } = await request(`${api}/${path}`, { method: "POST", headers, body: { pageNumber, pageSize: 1000, advancedFilter: { logic: "and", filters } } });
      const page = data as Page<T>;
      if (status !== 200 || !Array.isArray(page?.items)) throw new CarrierError(messageOf(data, `HTTP ${status}`));
      all.push(...page.items);
      if (!page.hasNext || !page.items.length) break;
    }
    return all;
  }

  async function territories(level: "wilaya" | "commune", parentId?: string) {
    const filters = [{ field: "level", operator: "eq" as const, value: level }, ...(parentId ? [{ field: "parentId", operator: "eq" as const, value: parentId }] : [])];
    // Filtered here too, in case the server ignores a filter
    return (await search<Territory>("territories/search", filters)).filter((t) => !parentId || !t.parentId || t.parentId === parentId);
  }

  async function address(p: ParcelInput) {
    const wilaya = (await territories("wilaya")).find((t) => Number(t.code) === p.wilayaCode || nameKey(t.name) === nameKey(p.wilayaName));
    if (!wilaya) throw new CarrierError(`Wilaya ${p.wilayaCode} non desservie par ZR Express`);
    const communes = await territories("commune", wilaya.id);
    const wanted = nameKey(p.commune);
    const commune = communes.find((c) => nameKey(c.name) === wanted) ?? communes.find((c) => wanted.length >= 4 && (nameKey(c.name).startsWith(wanted) || wanted.startsWith(nameKey(c.name))));
    if (!commune) throw new CarrierError(`Commune « ${p.commune} » introuvable chez ZR Express (${wilaya.name}) : écrivez-la en lettres latines, comme ZR`);
    return { wilaya, commune };
  }

  async function pickupHub(wilayaId: string, communeId: string) {
    const hubs = (await search<Hub>("hubs/search", [
      { field: "isPickupPoint", operator: "eq", value: true },
      { field: "address.cityTerritoryId", operator: "eq", value: wilayaId },
    ])).filter((h) => h.isPickupPoint !== false && (!h.address?.cityTerritoryId || h.address.cityTerritoryId === wilayaId));
    const hub = hubs.find((h) => h.address?.districtTerritoryId === communeId) ?? hubs[0];
    if (!hub) throw new CarrierError("Aucun stop desk ZR Express dans cette wilaya");
    return hub.id;
  }

  async function readParcel(idOrTracking: string) {
    const { status, data } = await request(`${api}/parcels/${encodeURIComponent(idOrTracking)}`, { headers });
    return status === 200 && (data as ZrParcel)?.id ? (data as ZrParcel) : null;
  }

  return {
    async test() {
      const { status } = await request(`${api}/territories/search`, { method: "POST", headers, body: { pageNumber: 1, pageSize: 1 } });
      if (status === 200) return true;
      if (status === 401 || status === 403) return false;
      throw new CarrierError(`HTTP ${status}`);
    },

    async createParcel(p: ParcelInput) {
      const { wilaya, commune } = await address(p);
      const products = p.products.slice(0, 250);
      const body = {
        customer: { customerId: crypto.randomUUID(), name: p.fullName, phone: { number1: `+213${normalizePhone(p.phone).replace(/^0/, "")}` } },
        deliveryAddress: { cityTerritoryId: wilaya.id, districtTerritoryId: commune.id, street: p.address || p.commune },
        orderedProducts: [{ productName: products, unitPrice: p.codAmount, quantity: 1, stockType: "none" }],
        deliveryType: p.stopDesk ? "pickup-point" : "home",
        ...(p.stopDesk ? { hubId: await pickupHub(wilaya.id, commune.id) } : {}),
        // What the customer pays (products + delivery as quoted)
        amount: p.codAmount,
        description: (p.note ? `${products} - ${p.note}` : products).slice(0, 250),
        externalId: p.reference.slice(0, 100),
      };
      const { status, data } = await request(`${api}/parcels`, { method: "POST", headers, body });
      const id = (data as { id?: string })?.id;
      if (status >= 400 || !id) throw new CarrierError(messageOf(data, `HTTP ${status}`));
      const parcel = await readParcel(id);
      return { trackingNumber: parcel?.trackingNumber || id, labelUrl: null };
    },

    async trackingStatus(tracking) {
      const parcel = await readParcel(tracking);
      const state = parcel?.state?.name;
      return state ? readableState(state) : null;
    },
  };
}
