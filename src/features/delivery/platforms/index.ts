import "server-only";
import type { CarrierPlatform } from "@/server/db/schema";
import { ecotrackClient } from "./ecotrack";
import { noestClient } from "./noest";
import { procolisClient } from "./procolis";
import type { CarrierClient, Credentials } from "./types";
import { yalidineClient } from "./yalidine";

export { CarrierError, type ParcelInput } from "./types";

const factories: Record<CarrierPlatform, (baseUrl: string, creds: Credentials) => CarrierClient> = {
  yalidine: yalidineClient,
  ecotrack: ecotrackClient,
  procolis: procolisClient,
  noest: noestClient,
};

// E2E_CARRIER_URL points every courier at a local fake server during the automated tests.
export function carrierClient(platform: CarrierPlatform, baseUrl: string, creds: Credentials): CarrierClient {
  return factories[platform](process.env.E2E_CARRIER_URL || baseUrl, creds);
}
