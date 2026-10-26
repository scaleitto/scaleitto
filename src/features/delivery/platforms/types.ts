import "server-only";

export type Credentials = Partial<Record<"apiId" | "apiToken" | "token" | "key" | "userGuid", string>>;

// One order, in the shape every courier needs (names in French: couriers use the French spelling).
export type ParcelInput = {
  reference: string;
  fullName: string;
  firstName: string;
  lastName: string;
  phone: string;
  wilayaCode: number;
  wilayaName: string;
  commune: string;
  address: string;
  products: string;
  // What the courier collects from the customer (products + delivery as quoted to the customer)
  codAmount: number;
  stopDesk: boolean;
  note: string;
  originWilayaCode: number;
  originWilayaName: string;
};

export type CreatedParcel = { trackingNumber: string; labelUrl?: string | null };

export interface CarrierClient {
  // true when the credentials are accepted
  test(): Promise<boolean>;
  createParcel(parcel: ParcelInput): Promise<CreatedParcel>;
  // The courier's own wording of the parcel's current status, or null when unknown
  trackingStatus(trackingNumber: string): Promise<string | null>;
}

// A refusal from the courier, shown to the merchant as is (e.g. "commune introuvable").
export class CarrierError extends Error {}

const TIMEOUT_MS = 20_000;

// JSON request with a timeout. Returns status + parsed body (or the text when not JSON).
export async function request(url: string, init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) {
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: { Accept: "application/json", ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}), ...init.headers },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: "error",
  });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    // keep the text
  }
  return { status: res.status, data: data as Record<string, unknown> & unknown };
}

// A readable message out of whatever error body a courier returns.
export function messageOf(data: unknown, fallback: string): string {
  if (typeof data === "string") return data.replace(/<[^>]+>/g, " ").trim().slice(0, 300) || fallback;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const k of ["message", "error", "MessageRetour", "detail", "errors"]) {
      const v = d[k];
      if (typeof v === "string" && v) return v.slice(0, 300);
      if (v && typeof v === "object") return JSON.stringify(v).slice(0, 300);
    }
  }
  return fallback;
}
