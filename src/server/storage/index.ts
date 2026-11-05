import "server-only";
import { env } from "../env";
import { LocalStorage } from "./local";
import { S3Storage } from "./s3";
import type { ByteRange, StorageDriver } from "./types";

let driver: StorageDriver | null = null;

export function storage(): StorageDriver {
  if (driver) return driver;
  const e = env();
  driver =
    e.STORAGE_DRIVER === "s3"
      ? new S3Storage(e.S3_BUCKET, {
          endpoint: e.S3_ENDPOINT,
          region: e.S3_REGION,
          accessKeyId: e.S3_ACCESS_KEY_ID,
          secretAccessKey: e.S3_SECRET_ACCESS_KEY,
          forcePathStyle: e.S3_FORCE_PATH_STYLE,
        })
      : new LocalStorage(e.STORAGE_LOCAL_DIR);
  return driver;
}

/** Parses a single HTTP byte range ("bytes=start-end", "bytes=start-", "bytes=-suffix"). */
export function parseRange(header: string | null, size: number): ByteRange | "invalid" | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return "invalid";
  let start: number;
  let end: number;
  if (m[1] === "") {
    const suffix = Number(m[2]);
    if (suffix === 0) return "invalid";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start > end || start >= size) return "invalid";
  return { start, end };
}

/**
 * Builds a streaming response for a stored object honoring HTTP Range requests
 * (required for seeking in <audio> and for efficient partial downloads).
 */
export async function streamObject(
  key: string,
  rangeHeader: string | null,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const s = storage();
  const meta = await s.stat(key);
  if (!meta) return new Response("Not found", { status: 404 });
  const range = parseRange(rangeHeader, meta.size);
  const base: Record<string, string> = {
    "accept-ranges": "bytes",
    "content-type": meta.contentType,
    ...extraHeaders,
  };
  if (range === "invalid") {
    return new Response(null, { status: 416, headers: { ...base, "content-range": `bytes */${meta.size}` } });
  }
  if (range) {
    const body = await s.read(key, range);
    return new Response(body, {
      status: 206,
      headers: {
        ...base,
        "content-length": String(range.end - range.start + 1),
        "content-range": `bytes ${range.start}-${range.end}/${meta.size}`,
      },
    });
  }
  const body = await s.read(key);
  return new Response(body, { status: 200, headers: { ...base, "content-length": String(meta.size) } });
}
