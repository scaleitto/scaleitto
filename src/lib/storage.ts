import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

// Uploaded images live OUTSIDE the app folder so replacing the app on update never deletes them.
export function uploadsDir() {
  return process.env.UPLOADS_DIR || path.join(os.homedir(), "scaleitto-uploads");
}

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

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

// Shrinks big photos to 1600px WebP when sharp is available on the server; otherwise keeps the original.
async function optimize(buf: Buffer, type: ImageType): Promise<{ buf: Buffer; type: ImageType }> {
  if (type.ext === "gif") return { buf, type };
  try {
    const sharp = (await import("sharp")).default;
    const out = await sharp(buf).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    return { buf: out, type: { ext: "webp", mime: "image/webp" } };
  } catch {
    return { buf, type };
  }
}

export async function saveImage(shopId: string, input: Buffer): Promise<string> {
  const type = sniffImage(input);
  if (!type) throw new Error("Unsupported image type");
  if (input.length > MAX_UPLOAD_BYTES) throw new Error("Image too large");
  const { buf, type: finalType } = await optimize(input, type);
  const name = `${randomUUID()}.${finalType.ext}`;
  const dir = path.join(uploadsDir(), shopId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);
  return `${(process.env.APP_URL ?? "").replace(/\/$/, "")}/uploads/${shopId}/${name}`;
}

const UUID = /^[0-9a-f-]{36}$/i;
const FILE = /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/i;

// Maps /uploads/<shop>/<file> to a path on disk, rejecting anything else (no path traversal).
export function uploadPath(shopId: string, file: string) {
  if (!UUID.test(shopId) || !FILE.test(file)) return null;
  return path.join(uploadsDir(), shopId, file);
}

// If the URL points to one of our uploads, return its bytes from disk.
export async function readOwnUpload(url: string): Promise<{ buf: Buffer; mime: string } | null> {
  const m = url.match(/\/uploads\/([0-9a-f-]{36})\/([0-9a-f-]{36}\.(jpg|png|webp|gif))$/i);
  if (!m) return null;
  const p = uploadPath(m[1], m[2]);
  if (!p) return null;
  try {
    return { buf: await readFile(p), mime: mimeForExt(m[3].toLowerCase()) };
  } catch {
    return null;
  }
}
