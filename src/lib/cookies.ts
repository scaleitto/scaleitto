// Cookies a site sets while redirecting (some sites loop until their cookie comes back): used by safeFetch
export function mergeCookies(jar: Map<string, string>, setCookies: string[]) {
  for (const header of setCookies) {
    const [pair] = header.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
  return jar;
}
export const cookieHeader = (jar: Map<string, string>) => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
