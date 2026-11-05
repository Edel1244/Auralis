import "server-only";
import type SharpType from "sharp";

// Loaded on first use so that a missing native image library can only affect
// image uploads, never server boot or unrelated API routes.
let sharpPromise: Promise<typeof SharpType> | null = null;
const loadSharp = () => (sharpPromise ??= import("sharp").then((m) => (m.default ?? m) as typeof SharpType));
import { ApiError } from "../http";
import { storage } from "../storage";
import { randomToken } from "../security/crypto";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export type ImageKind = "avatar" | "banner" | "cover" | "playlist";
const SIZES: Record<ImageKind, { width: number; height: number }> = {
  avatar: { width: 400, height: 400 },
  banner: { width: 1800, height: 600 },
  cover: { width: 1000, height: 1000 },
  playlist: { width: 1000, height: 1000 },
};

/** Reads an image File from multipart form data, enforcing size limits. */
export async function readImageFile(file: FormDataEntryValue | null): Promise<Buffer> {
  if (!file || typeof file === "string") throw new ApiError("BAD_REQUEST", "An image file is required");
  if (file.size > MAX_IMAGE_BYTES) throw new ApiError("PAYLOAD_TOO_LARGE", "Images must be 8 MB or smaller");
  return Buffer.from(await file.arrayBuffer());
}

/**
 * Decodes, validates (by actually decoding — never trusting the extension),
 * strips metadata, resizes and re-encodes to WebP, then stores it.
 * Re-encoding also neutralizes polyglot/malicious image payloads.
 */
export async function storeImage(buf: Buffer, kind: ImageKind, ownerId: string): Promise<string> {
  let out: Buffer;
  const sharp = await loadSharp();
  try {
    const meta = await sharp(buf, { limitInputPixels: 50_000_000 }).metadata();
    if (!meta.format || !["jpeg", "png", "webp", "gif", "avif"].includes(meta.format)) throw new Error("format");
    out = await sharp(buf, { limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ ...SIZES[kind], fit: "cover", position: "attention" })
      .webp({ quality: 84 })
      .toBuffer();
  } catch {
    throw new ApiError("UNSUPPORTED_MEDIA", "Unsupported or corrupt image (use JPEG, PNG, WebP or GIF)");
  }
  const key = `images/${kind}/${ownerId}/${randomToken(12)}.webp`;
  await storage().put(key, out, "image/webp");
  return key;
}

export async function deleteObjectQuietly(key: string | null | undefined) {
  if (!key) return;
  await storage().delete(key).catch(() => {});
}
