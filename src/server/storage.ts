import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

// Paths below are marked turbopackIgnore: they point outside the app, so the build must not trace them.
// Uploaded images live OUTSIDE the app folder so replacing the app on update never deletes them.
export function uploadsDir() {
  return process.env.UPLOADS_DIR || path.join(/* turbopackIgnore: true */ os.homedir(), "scaleitto-uploads");
}

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

// A problem with the file itself (shown to the user), not a server failure.
export class UploadError extends Error {
  constructor(public reason: "type" | "size" | "empty") {
    super(`Upload refused: ${reason}`);
  }
}

type ImageType = { ext: "jpg" | "png" | "webp" | "gif"; mime: string };

// Detect the real type from the file's first bytes (never trust the name or the browser).
export function sniffImage(buf: Buffer): ImageType | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", mime: "image/png" };
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return { ext: "webp", mime: "image/webp" };
  if (buf.toString("ascii", 0, 4) === "GIF8") return { ext: "gif", mime: "image/gif" };
  return null;
}

export const mimeForExt = (ext: string) =>
  ({ jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" })[ext] ?? "application/octet-stream";

export async function saveImage(shopId: string, input: Buffer): Promise<string> {
  const type = sniffImage(input);
  if (!type) throw new UploadError("type");
  if (input.length > MAX_UPLOAD_BYTES) throw new UploadError("size");
  // Images are resized in the browser before upload; the server only stores them
  // (no native image library, so nothing can break on shared hosting).
  const name = `${randomUUID()}.${type.ext}`;
  const dir = path.join(/* turbopackIgnore: true */ uploadsDir(), shopId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(/* turbopackIgnore: true */ dir, name), input);
  // A path, not a full URL, so images keep working on subdomains and custom domains.
  return `/uploads/${shopId}/${name}`;
}

const UUID = /^[0-9a-f-]{36}$/i;
const FILE = /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/i;

// Maps /uploads/<shop>/<file> to a path on disk, rejecting anything else (no path traversal).
export function uploadPath(shopId: string, file: string) {
  if (!UUID.test(shopId) || !FILE.test(file)) return null;
  return path.join(/* turbopackIgnore: true */ uploadsDir(), shopId, file);
}

// The bytes of one of our uploads from its path ("/uploads/<shop>/<file>"), or null.
export async function readUpload(urlPath: string): Promise<{ buf: Buffer; mime: string } | null> {
  const m = urlPath.match(/^\/uploads\/([0-9a-f-]{36})\/([0-9a-f-]{36}\.(jpg|png|webp|gif))$/i);
  const p = m ? uploadPath(m[1], m[2]) : null;
  if (!p) return null;
  try {
    return { buf: await readFile(/* turbopackIgnore: true */ p), mime: mimeForExt(m![3].toLowerCase()) };
  } catch {
    return null;
  }
}
