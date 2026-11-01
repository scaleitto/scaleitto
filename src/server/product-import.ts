import "server-only";
import { safeFetch } from "./safe-fetch";

// Copies remote product images into our own uploads (so pages don't depend on the source site).
// Downloads run in parallel with a short timeout so this step stays quick.
export async function downloadImages(shopId: string, urls: string[], max = 6): Promise<string[]> {
  const { saveImage, MAX_UPLOAD_BYTES } = await import("@/server/storage");
  const results = await Promise.all(
    urls.slice(0, max).map(async (url) => {
      try {
        const res = await safeFetch(url, { maxBytes: MAX_UPLOAD_BYTES, timeoutMs: 10_000, accept: "image/*" });
        return res.status === 200 ? await saveImage(shopId, res.body) : null;
      } catch {
        return null; // skip images that cannot be downloaded or are not real images
      }
    }),
  );
  return results.filter((u): u is string => !!u);
}
