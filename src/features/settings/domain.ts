import "server-only";
import { randomBytes } from "node:crypto";
import { resolveCname, resolve4, resolveTxt } from "node:dns/promises";
import { getCurrentPlan } from "@/server/limits";
export { normalizeDomain } from "./domain-name";

export const DOMAIN_FEATURE = "custom_domain";

export const newDomainToken = () => randomBytes(16).toString("hex");
export const txtName = (domain: string) => `_scaleitto.${domain}`;

export async function planAllowsDomain(shopId: string) {
  return Boolean((await getCurrentPlan(shopId))?.plan.features.includes(DOMAIN_FEATURE));
}

// Where merchants point their domain: a CNAME target and/or the server's IP (from the environment)
export function domainTarget() {
  return { cname: process.env.DOMAIN_CNAME_TARGET?.trim() || null, ip: process.env.SERVER_IP?.trim() || null };
}

// DNS answers. E2E_DNS_URL points at a fake resolver during the automated tests.
async function lookup(name: string, type: "TXT" | "CNAME" | "A"): Promise<string[]> {
  const fake = process.env.E2E_DNS_URL;
  if (fake) {
    const res = await fetch(`${fake}/dns?name=${encodeURIComponent(name)}&type=${type}`, { signal: AbortSignal.timeout(5000) });
    return res.ok ? ((await res.json()) as string[]) : [];
  }
  const timeout = new Promise<string[]>((resolve) => setTimeout(() => resolve([]), 6000));
  const query = (type === "TXT" ? resolveTxt(name).then((r) => r.map((parts) => parts.join(""))) : type === "CNAME" ? resolveCname(name) : resolve4(name)).catch(() => [] as string[]);
  return Promise.race([query, timeout]);
}

const clean = (v: string) => v.toLowerCase().replace(/\.$/, "");

// Checks ownership (TXT record) and that the domain points to the platform: a CNAME on www.<domain>
// (a bare domain cannot carry a CNAME) or on the domain itself (sub-domains), or an A record to the server.
export async function checkDomain(domain: string, token: string) {
  const target = domainTarget();
  const [txt, cnameWww, cnameSelf, a] = await Promise.all([lookup(txtName(domain), "TXT"), lookup(`www.${domain}`, "CNAME"), lookup(domain, "CNAME"), lookup(domain, "A")]);
  const cname = [...cnameWww, ...cnameSelf];
  const owned = txt.some((v) => v.trim() === `scaleitto-verify=${token}`);
  const pointed =
    !target.cname && !target.ip
      ? true // nothing configured on this platform: only ownership can be checked
      : (target.cname !== null && cname.map(clean).includes(clean(target.cname))) || (target.ip !== null && a.includes(target.ip));
  return { owned, pointed, found: { cname: cname.map(clean), a } };
}
