import { getManagerContext } from "@/lib/auth";
import { MAX_UPLOAD_BYTES, saveImage } from "@/lib/storage";
import { logError } from "@/lib/error-log";

// Uploads ONE image per request, sent as the raw request body (already resized by the browser).
export async function POST(req: Request) {
  const ctx = await getManagerContext();
  if (!ctx) return Response.json({ error: "Not signed in" }, { status: 401 });

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES) return Response.json({ error: "Image too large (max 8 MB)" }, { status: 413 });

  try {
    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.length === 0) return Response.json({ error: "Empty file" }, { status: 400 });
    if (buf.length > MAX_UPLOAD_BYTES) return Response.json({ error: "Image too large (max 8 MB)" }, { status: 413 });
    return Response.json({ url: await saveImage(ctx.shop.id, buf) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/Unsupported image type|too large/.test(message)) return Response.json({ error: message }, { status: 400 });
    await logError("api/uploads", err);
    return Response.json({ error: `Could not save the image: ${message}` }, { status: 500 });
  }
}
