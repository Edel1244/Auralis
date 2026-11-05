import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../env";

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

/** Tokens (sessions, email links) are stored only as SHA-256 hashes. */
export function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

export function hmac(value: string) {
  return createHmac("sha256", env().AUTH_SECRET).update(value).digest("base64url");
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Short-lived signed URL token for media streaming: `<expires>.<signature>`
 * bound to the storage key and the requesting user. Lets <audio> elements
 * stream private audio without exposing session tokens in URLs.
 */
export function signMediaToken(key: string, userId: string | null, ttlSeconds = 6 * 3600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = hmac(`${key}|${userId ?? "anon"}|${exp}`);
  return `${exp}.${sig}`;
}

export function verifyMediaToken(key: string, userId: string | null, token: string | null) {
  if (!token) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!exp || !sig || exp < Date.now() / 1000) return false;
  return safeEqual(sig, hmac(`${key}|${userId ?? "anon"}|${exp}`));
}
