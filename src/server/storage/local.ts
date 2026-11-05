import "server-only";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { ByteRange, StorageDriver } from "./types";
import { contentTypeForKey } from "./mime";

export class LocalStorage implements StorageDriver {
  private root: string;

  constructor(dir: string) {
    // path.resolve() is relative to the working directory; avoiding an explicit
    // process.cwd() keeps the build tracer from bundling the whole project.
    this.root = path.resolve(dir);
  }

  /** Resolves a key inside the storage root, rejecting path traversal. */
  private file(key: string) {
    if (!/^[a-zA-Z0-9/_.-]+$/.test(key) || key.includes("..") || key.startsWith("/")) {
      throw new Error("Invalid storage key");
    }
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
    return full;
  }

  async put(key: string, body: Buffer) {
    const f = this.file(key);
    await mkdir(path.dirname(f), { recursive: true });
    await writeFile(f, body);
  }

  async putFile(key: string, filePath: string) {
    const f = this.file(key);
    await mkdir(path.dirname(f), { recursive: true });
    await copyFile(filePath, f);
  }

  async stat(key: string) {
    try {
      const s = await stat(this.file(key));
      return { size: s.size, contentType: contentTypeForKey(key) };
    } catch {
      return null;
    }
  }

  async read(key: string, range?: ByteRange) {
    const stream = createReadStream(this.file(key), range ? { start: range.start, end: range.end } : undefined);
    return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
  }

  readBuffer(key: string) {
    return readFile(this.file(key));
  }

  async delete(key: string) {
    await rm(this.file(key), { force: true });
  }
}
