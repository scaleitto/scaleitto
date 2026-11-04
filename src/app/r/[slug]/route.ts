import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { REF_COOKIE } from "@/features/referrals/referrals";

// A store's referral link (Store settings → Refer a seller): remembers the store for 30 days, then opens the sign-up page
export async function GET(req: Request, { params }: RouteContext<"/r/[slug]">) {
  const slug = decodeURIComponent((await params).slug).toLowerCase();
  const lang = /^(fr|en)/i.exec(req.headers.get("accept-language") ?? "")?.[1]?.toLowerCase() ?? "ar";

  const [shop] = /^[a-z0-9-]{1,60}$/.test(slug) ? await db.select({ id: schema.shops.id }).from(schema.shops).where(eq(schema.shops.slug, slug)) : [];
  // A relative address: behind a proxy req.url can carry the server's own host
  const headers = new Headers({ Location: `/${lang}/register` });
  if (shop) headers.append("Set-Cookie", `${REF_COOKIE}=${shop.id}; Path=/; Max-Age=${30 * 86400}; SameSite=Lax; HttpOnly`);
  return new Response(null, { status: 307, headers });
}
