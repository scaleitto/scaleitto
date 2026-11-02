import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// AES-256-GCM for secrets stored in the database (delivery companies' API keys).
// The key comes from APP_SECRET, or from DATABASE_URL when APP_SECRET is not set,
// so a stolen database dump alone does not reveal the keys.
function key() {
  const secret = process.env.APP_SECRET || process.env.DATABASE_URL;
  if (!secret) throw new Error("APP_SECRET (or DATABASE_URL) is required to encrypt secrets");
  return createHash("sha256").update(`scaleitto:${secret}`).digest();
}

export function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}

export function decryptJson<T>(payload: string): T {
  const [version, iv, tag, data] = payload.split(".");
  if (version !== "v1") throw new Error("Unknown secret format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8")) as T;
}

// The key of the cron URL that sends late orders to the apps (/api/cron/apps?key=…): derived from the
// same secret, so it changes with it and is never stored.
export function cronKey() {
  return createHash("sha256").update(`scaleitto-cron:${process.env.APP_SECRET || process.env.DATABASE_URL || ""}`).digest("hex").slice(0, 32);
}

// The private part of an order's tracking link (/store/<slug>/track?o=<id>&k=<token>): derived from the secret, never stored
export function orderToken(orderId: string) {
  return createHash("sha256").update(`scaleitto-track:${process.env.APP_SECRET || process.env.DATABASE_URL || ""}:${orderId}`).digest("base64url").slice(0, 22);
}
