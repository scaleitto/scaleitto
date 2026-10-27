import "server-only";
import { readUpload } from "@/server/storage";

// Photos the model looks at: our own uploads are sent as data, links as links.
export async function visionImages(images: string[], max = 6) {
  const out: string[] = [];
  for (const src of images.slice(0, max)) {
    if (src.startsWith("/uploads/")) {
      const file = await readUpload(src);
      if (file) out.push(`data:${file.mime};base64,${file.buf.toString("base64")}`);
    } else if (/^https:\/\//.test(src)) out.push(src);
  }
  return out;
}
