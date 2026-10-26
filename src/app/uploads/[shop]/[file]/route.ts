import { readFile } from "node:fs/promises";
import { mimeForExt, uploadPath } from "@/lib/storage";

// Serves uploaded images from the uploads folder (outside the app directory).
export async function GET(_req: Request, ctx: RouteContext<"/uploads/[shop]/[file]">) {
  const { shop, file } = await ctx.params;
  const p = uploadPath(shop, file);
  if (!p) return new Response("Not found", { status: 404 });
  try {
    const buf = await readFile(p);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": mimeForExt(file.split(".").pop()!.toLowerCase()),
        // File names are random and never reused, so they can be cached forever.
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
