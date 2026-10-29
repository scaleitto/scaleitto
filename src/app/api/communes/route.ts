import { communesOf } from "@/lib/communes";

// One wilaya's communes for the order forms: [[latin, arabic], …]. The list never changes, browsers keep it.
export async function GET(req: Request) {
  const w = Number(new URL(req.url).searchParams.get("w"));
  if (!Number.isInteger(w) || w < 1 || w > 58) return Response.json([], { status: 400 });
  return Response.json(communesOf(w), { headers: { "Cache-Control": "public, max-age=86400, immutable" } });
}
