import "server-only";
import { createReadStream } from "node:fs";
import { stat as fsStat } from "node:fs/promises";
import { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { ByteRange, StorageDriver } from "./types";

export class S3Storage implements StorageDriver {
  private client: S3Client;

  constructor(
    private bucket: string,
    opts: { endpoint?: string; region: string; accessKeyId?: string; secretAccessKey?: string; forcePathStyle: boolean },
  ) {
    this.client = new S3Client({
      endpoint: opts.endpoint || undefined,
      region: opts.region,
      forcePathStyle: opts.forcePathStyle,
      credentials:
        opts.accessKeyId && opts.secretAccessKey
          ? { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey }
          : undefined,
    });
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async putFile(key: string, filePath: string, contentType: string) {
    const { size } = await fsStat(filePath);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: createReadStream(filePath),
        ContentLength: size,
        ContentType: contentType,
      }),
    );
  }

  async stat(key: string) {
    try {
      const r = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: Number(r.ContentLength ?? 0), contentType: r.ContentType ?? "application/octet-stream" };
    } catch {
      return null;
    }
  }

  async read(key: string, range?: ByteRange) {
    const r = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Range: range ? `bytes=${range.start}-${range.end}` : undefined,
      }),
    );
    const body = r.Body as Readable;
    return Readable.toWeb(body) as ReadableStream<Uint8Array>;
  }

  async readBuffer(key: string) {
    const r = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(await r.Body!.transformToByteArray());
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
