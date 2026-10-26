import { getManagerContext } from "@/lib/auth";
import { MAX_UPLOAD_BYTES, saveImage } from "@/lib/storage";

const MAX_FILES = 10;

// Image upload for shop managers (product photos, landing page images).
export async function POST(req: Request) {
  const ctx = await getManagerContext();
  if (!ctx) return Response.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const files = (form?.getAll("files") ?? []).filter((f): f is File => f instanceof File).slice(0, MAX_FILES);
  if (files.length === 0) return Response.json({ error: "no files" }, { status: 400 });

  const urls: string[] = [];
  const errors: string[] = [];
  for (const file of files) {
    if (file.size > MAX_UPLOAD_BYTES) {
      errors.push(`${file.name}: too large`);
      continue;
    }
    try {
      urls.push(await saveImage(ctx.shop.id, Buffer.from(await file.arrayBuffer())));
    } catch (err) {
      errors.push(`${file.name}: ${err instanceof Error ? err.message : "failed"}`);
    }
  }
  return Response.json({ urls, errors });
}
