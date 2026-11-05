export type ByteRange = { start: number; end: number }; // inclusive

export type StoredObject = { size: number; contentType: string };

/** S3-compatible object storage contract. Keys are POSIX-style relative paths. */
export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Streams an existing local file (avoids buffering large uploads in memory). */
  putFile(key: string, filePath: string, contentType: string): Promise<void>;
  stat(key: string): Promise<StoredObject | null>;
  read(key: string, range?: ByteRange): Promise<ReadableStream<Uint8Array>>;
  readBuffer(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
