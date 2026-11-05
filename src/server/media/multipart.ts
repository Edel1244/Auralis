import "server-only";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import Busboy from "busboy";
import type { NextRequest } from "next/server";
import { ApiError } from "../http";
import { randomToken } from "../security/crypto";

export type SpooledFile = {
  field: string;
  filename: string;
  mimeType: string;
  path: string;
  size: number;
  sha256: string;
  head: Buffer; // first bytes, for magic-number sniffing
};

export type MultipartResult = { fields: Record<string, string>; files: SpooledFile[]; cleanup: () => Promise<void> };

/**
 * Streams a multipart request to temporary files (never buffering whole audio
 * files in memory), hashing on the fly and enforcing per-file and count limits.
 */
export async function parseMultipart(
  req: NextRequest,
  opts: { maxFileBytes: number; maxFiles: number; fileFields: string[] },
): Promise<MultipartResult> {
  const ctype = req.headers.get("content-type") ?? "";
  if (!ctype.startsWith("multipart/form-data") || !req.body) throw new ApiError("BAD_REQUEST", "Expected multipart/form-data");
  const dir = path.join(os.tmpdir(), "auralis-upload", randomToken(9));
  await mkdir(dir, { recursive: true });
  const cleanup = () => rm(dir, { recursive: true, force: true });

  const fields: Record<string, string> = {};
  const files: SpooledFile[] = [];
  const pending: Promise<void>[] = [];

  try {
    await new Promise<void>((resolve, reject) => {
      const bb = Busboy({
        headers: { "content-type": ctype },
        limits: { fileSize: opts.maxFileBytes, files: opts.maxFiles, fields: 50, fieldSize: 64 * 1024 },
      });
      bb.on("field", (name, value) => {
        fields[name] = value;
      });
      bb.on("file", (field, stream, info) => {
        if (!opts.fileFields.includes(field)) {
          stream.resume();
          return;
        }
        const target = path.join(dir, `${files.length}-${randomToken(6)}`);
        const hash = createHash("sha256");
        const headChunks: Buffer[] = [];
        let headLen = 0;
        let size = 0;
        const out = createWriteStream(target);
        const entry: SpooledFile = {
          field,
          filename: path.basename(info.filename || "upload").slice(0, 200),
          mimeType: info.mimeType,
          path: target,
          size: 0,
          sha256: "",
          head: Buffer.alloc(0),
        };
        files.push(entry);
        stream.on("data", (chunk: Buffer) => {
          size += chunk.length;
          hash.update(chunk);
          if (headLen < 64) {
            headChunks.push(chunk);
            headLen += chunk.length;
          }
        });
        stream.on("limit", () => reject(new ApiError("PAYLOAD_TOO_LARGE", `File exceeds ${Math.round(opts.maxFileBytes / 1048576)} MB`)));
        pending.push(
          new Promise((res, rej) => {
            out.on("finish", () => {
              entry.size = size;
              entry.sha256 = hash.digest("hex");
              entry.head = Buffer.concat(headChunks).subarray(0, 64);
              res();
            });
            out.on("error", rej);
          }),
        );
        stream.pipe(out);
      });
      bb.on("filesLimit", () => reject(new ApiError("BAD_REQUEST", `At most ${opts.maxFiles} files per request`)));
      bb.on("error", (e) => reject(e instanceof ApiError ? e : new ApiError("BAD_REQUEST", "Malformed upload")));
      bb.on("close", () => resolve());
      Readable.fromWeb(req.body as unknown as import("node:stream/web").ReadableStream).pipe(bb);
    });
    await Promise.all(pending);
    return { fields, files, cleanup };
  } catch (e) {
    await cleanup();
    throw e;
  }
}
