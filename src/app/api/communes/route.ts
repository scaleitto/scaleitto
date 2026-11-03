import { communesOf } from "@/lib/communes";
import { WILAYA_COUNT } from "@/lib/wilayas";

// One wilaya's communes for the order forms: [[latin, arabic], …]. Browsers keep it for a day.
export async function GET(req: Request) {
  const w = Number(new URL(req.url).searchParams.get("w"));
  if (!Number.isInteger(w) || w < 1 || w > WILAYA_COUNT) return Response.json([], { status: 400 });
  return Response.json(communesOf(w), { headers: { "Cache-Control": "public, max-age=86400" } });
}
