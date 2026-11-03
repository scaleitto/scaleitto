import "server-only";

// Cloudflare Turnstile (Apps → Fake OrderGuard → Checkout captcha), with the platform's own keys: TURNSTILE_SITE_KEY (shown
// in the store's forms) and TURNSTILE_SECRET_KEY (checks the answer). No keys = the option is not available.
// API: POST https://challenges.cloudflare.com/turnstile/v0/siteverify (secret, response, remoteip) → { success }.
// E2E_TURNSTILE_URL points it at the tests' fake server (never in production).
export const turnstileSiteKey = () => (process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY ? process.env.TURNSTILE_SITE_KEY : null);

export type TurnstileResult = "ok" | "failed" | "unreachable";

export async function verifyTurnstile(token: string | null | undefined, ip: string | null): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return "ok";
  if (!token || token.length > 2048) return "failed";
  const url = `${process.env.E2E_TURNSTILE_URL ?? "https://challenges.cloudflare.com"}/turnstile/v0/siteverify`;
  try {
    const body = new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) });
    const res = await fetch(url, { method: "POST", body, signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return "unreachable";
    const j = (await res.json()) as { success?: boolean };
    return j.success ? "ok" : "failed";
  } catch {
    return "unreachable";
  }
}

// What the store's order forms show: the widget on every order, only after a suspicious attempt, or nothing
export function storeCaptcha(protection: { enabled: boolean; captcha: "never" | "always" | "risky" }) {
  const siteKey = turnstileSiteKey();
  return siteKey && protection.enabled && protection.captcha !== "never" ? { siteKey, mode: protection.captcha } : null;
}
