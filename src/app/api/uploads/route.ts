import { getShopContext } from "@/server/auth/context";
import { canAccess } from "@/lib/permissions";
import { MAX_UPLOAD_BYTES, UploadError, saveImage } from "@/server/storage";
import { logError } from "@/server/errors";

// Uploads ONE image per request, sent as the raw body (the browser already resized it).
// Answers { url } or { error: "type" | "size" | "empty" | "auth" | "unexpected" } for the UI to translate.
export async function POST(req: Request) {
  const ctx = await getShopContext();
  if (!ctx || !canAccess(ctx.role, "products")) return Response.json({ error: "auth" }, { status: 403 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES) return Response.json({ error: "size" }, { status: 413 });
  try {
    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.length === 0) throw new UploadError("empty");
    return Response.json({ url: await saveImage(ctx.shop.id, buf) });
  } catch (err) {
    if (err instanceof UploadError) return Response.json({ error: err.reason }, { status: 400 });
    await logError("api/uploads", err);
    return Response.json({ error: "unexpected" }, { status: 500 });
  }
}
