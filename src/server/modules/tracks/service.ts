import "server-only";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { z } from "zod";
import type { User } from "@prisma/client";
import { parseStream } from "music-metadata";
import { db } from "../../db";
import { env } from "../../env";
import { ApiError } from "../../http";
import { logger } from "../../logger";
import { storage } from "../../storage";
import { parseMultipart } from "../../media/multipart";
import { sanitizeAnalysis, sniffAudio } from "../../media/audio";
import { deleteObjectQuietly, storeImage } from "../../media/images";
import { enqueueJob } from "../../jobs/queue";
import { notify } from "../notifications/notify";
import { visibilitySchema } from "@/lib/validation";
import { readFile } from "node:fs/promises";

const tagList = z
  .array(z.string().trim().toLowerCase().min(1).max(30))
  .max(15)
  .transform((tags) => [...new Set(tags)]);

export const trackMetaSchema = z.object({
  title: z.string().trim().max(200).optional(),
  artistName: z.string().trim().max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  genreId: z.string().max(40).nullable().optional(),
  tags: tagList.optional(),
  mood: z.string().trim().max(30).nullable().optional(),
  releaseDate: z.coerce.date().nullable().optional(),
  visibility: visibilitySchema.default("PUBLIC"),
  explicit: z.boolean().default(false),
  commentsEnabled: z.boolean().default(true),
  ownership: z.enum(["ORIGINAL", "LICENSED", "PUBLIC_DOMAIN", "CREATIVE_COMMONS"]).default("ORIGINAL"),
  licenseNote: z.string().trim().max(500).default(""),
  albumId: z.string().max(40).nullable().optional(),
  trackNumber: z.number().int().min(1).max(999).nullable().optional(),
  rightsConfirmed: z.literal(true, { error: "You must confirm you have the rights to upload this audio" }),
  analysis: z.unknown().optional(),
});

export const trackUpdateSchema = trackMetaSchema
  .omit({ rightsConfirmed: true, analysis: true })
  .partial()
  .extend({ title: z.string().trim().min(1).max(200).optional(), artistName: z.string().trim().min(1).max(120).optional() });

function titleFromFilename(name: string) {
  return (
    name
      .replace(/\.[a-z0-9]{2,5}$/i, "")
      .replace(/[_]+/g, " ")
      .replace(/^\d{1,3}[\s.-]+/, "")
      .trim()
      .slice(0, 200) || "Untitled"
  );
}

/** Atomically reserves storage quota; returns false when it would be exceeded. */
async function reserveQuota(userId: string, bytes: number) {
  const n = await db.$executeRaw`UPDATE "User" SET "storageUsedBytes" = "storageUsedBytes" + ${BigInt(bytes)}
    WHERE "id" = ${userId} AND "storageUsedBytes" + ${BigInt(bytes)} <= "storageQuotaBytes"`;
  return n === 1;
}
export async function releaseQuota(userId: string, bytes: bigint | number) {
  await db.$executeRaw`UPDATE "User" SET "storageUsedBytes" = GREATEST(0, "storageUsedBytes" - ${BigInt(bytes)}) WHERE "id" = ${userId}`;
}

/** Handles a single-track upload request (audio + optional artwork + JSON meta). */
export async function handleUpload(req: NextRequest, user: User) {
  const e = env();
  if (e.REQUIRE_VERIFIED_EMAIL_FOR_UPLOAD && !user.emailVerifiedAt) {
    throw new ApiError("FORBIDDEN", "Verify your email before uploading");
  }
  const maxBytes = e.MAX_UPLOAD_MB * 1024 * 1024;
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes + 10 * 1024 * 1024) throw new ApiError("PAYLOAD_TOO_LARGE", `Files must be ${e.MAX_UPLOAD_MB} MB or smaller`);

  const mp = await parseMultipart(req, { maxFileBytes: maxBytes, maxFiles: 2, fileFields: ["audio", "artwork"] });
  let reserved = 0;
  try {
    let metaRaw: unknown;
    try {
      metaRaw = JSON.parse(mp.fields.meta ?? "{}");
    } catch {
      throw new ApiError("BAD_REQUEST", "meta must be JSON");
    }
    const meta = trackMetaSchema.parse(metaRaw);
    const audio = mp.files.find((f) => f.field === "audio");
    if (!audio || audio.size === 0) throw new ApiError("BAD_REQUEST", "An audio file is required");
    const kind = sniffAudio(audio.head, audio.filename);
    if (!kind) throw new ApiError("UNSUPPORTED_MEDIA", "Unsupported audio format. Use MP3, WAV, FLAC, OGG, M4A or AAC.");

    const dup = await db.track.findFirst({
      where: { ownerId: user.id, sha256: audio.sha256, status: { not: "REMOVED" } },
      select: { id: true, title: true },
    });
    if (dup) throw new ApiError("CONFLICT", `You already uploaded this file ("${dup.title}")`, { field: "duplicate", trackId: dup.id });

    if (meta.albumId) {
      const album = await db.album.findUnique({ where: { id: meta.albumId }, select: { ownerId: true } });
      if (!album || album.ownerId !== user.id) throw new ApiError("FORBIDDEN", "You can only add tracks to your own albums");
    }
    if (meta.genreId && !(await db.genre.findUnique({ where: { id: meta.genreId } }))) meta.genreId = null;

    if (!(await reserveQuota(user.id, audio.size))) {
      throw new ApiError("QUOTA_EXCEEDED", "Not enough storage space left for this upload");
    }
    reserved = audio.size;

    const id = randomUUID().replace(/-/g, "");
    const audioKey = `audio/${user.id}/${id}/original.${kind.ext}`;
    await storage().putFile(audioKey, audio.path, kind.mime);

    let coverKey: string | null = null;
    const art = mp.files.find((f) => f.field === "artwork");
    if (art && art.size > 0) {
      if (art.size > 8 * 1024 * 1024) throw new ApiError("PAYLOAD_TOO_LARGE", "Artwork must be 8 MB or smaller");
      coverKey = await storeImage(await readFile(art.path), "cover", user.id);
    }

    const analysis = sanitizeAnalysis(meta.analysis);
    const autoTitle = !meta.title;
    const autoArtist = !meta.artistName;
    const track = await db.track.create({
      data: {
        id,
        ownerId: user.id,
        title: meta.title || titleFromFilename(audio.filename),
        artistName: meta.artistName || user.displayName,
        description: meta.description ?? "",
        genreId: meta.genreId ?? null,
        tags: meta.tags ?? [],
        mood: meta.mood ?? null,
        releaseDate: meta.releaseDate ?? null,
        visibility: meta.visibility,
        explicit: meta.explicit,
        commentsEnabled: meta.commentsEnabled,
        ownership: meta.ownership,
        licenseNote: meta.licenseNote,
        albumId: meta.albumId ?? null,
        trackNumber: meta.trackNumber ?? null,
        audioKey,
        originalName: audio.filename,
        mimeType: kind.mime,
        lossless: kind.lossless,
        sizeBytes: BigInt(audio.size),
        sha256: audio.sha256,
        coverKey,
        waveform: analysis.waveform ?? undefined,
        loudnessDb: analysis.loudnessDb,
        bpm: analysis.bpm,
        status: "PROCESSING",
      },
    });
    reserved = 0; // now owned by the track row
    enqueueTrackProcessing(track.id, { autoTitle, autoArtist });
    return track;
  } catch (err) {
    if (reserved) await releaseQuota(user.id, reserved);
    throw err;
  } finally {
    await mp.cleanup();
  }
}

export function enqueueTrackProcessing(trackId: string, flags: { autoTitle?: boolean; autoArtist?: boolean } = {}) {
  enqueueJob("process-track", `track:${trackId}`, () => processTrack(trackId, flags));
}

/** Background job: authoritative metadata extraction, embedded artwork, genre mapping. */
export async function processTrack(trackId: string, flags: { autoTitle?: boolean; autoArtist?: boolean }) {
  const track = await db.track.findUnique({ where: { id: trackId } });
  if (!track || track.status !== "PROCESSING") return;
  try {
    const web = await storage().read(track.audioKey);
    const node = Readable.fromWeb(web as unknown as import("node:stream/web").ReadableStream);
    const meta = await parseStream(node, { mimeType: track.mimeType, size: Number(track.sizeBytes) }, { duration: true });
    node.destroy();
    const f = meta.format;
    const c = meta.common;
    const durationMs = Math.round((f.duration ?? 0) * 1000);
    if (!durationMs) throw new Error("Could not determine audio duration (file may be corrupt)");

    let coverKey = track.coverKey;
    const pic = c.picture?.[0];
    if (!coverKey && pic) {
      coverKey = await storeImage(Buffer.from(pic.data), "cover", track.ownerId).catch(() => null);
    }
    let genreId = track.genreId;
    if (!genreId && c.genre?.[0]) {
      const g = await db.genre.findFirst({ where: { name: { equals: c.genre[0].trim(), mode: "insensitive" }, active: true } });
      genreId = g?.id ?? null;
    }
    await db.track.update({
      where: { id: trackId },
      data: {
        status: "READY",
        statusReason: null,
        durationMs,
        bitrate: f.bitrate ? Math.round(f.bitrate) : null,
        sampleRate: f.sampleRate ?? null,
        channels: f.numberOfChannels ?? null,
        codec: f.codec ?? f.container ?? null,
        lossless: f.lossless ?? track.lossless,
        title: flags.autoTitle && c.title ? c.title.slice(0, 200) : undefined,
        artistName: flags.autoArtist && c.artist ? c.artist.slice(0, 120) : undefined,
        trackNumber: track.trackNumber ?? c.track?.no ?? null,
        bpm: track.bpm ?? (c.bpm && c.bpm >= 40 && c.bpm <= 240 ? c.bpm : null),
        coverKey,
        genreId,
      },
    });
    await notify(track.ownerId, "upload_ready", { trackId, title: track.title });
  } catch (e) {
    logger.warn("track_processing_failed", { trackId, error: String(e) });
    await db.track.update({ where: { id: trackId }, data: { status: "FAILED", statusReason: String((e as Error).message).slice(0, 300) } });
    await notify(track.ownerId, "upload_failed", { trackId, title: track.title });
  }
}

/** Permanently deletes a track and its stored objects, releasing quota. */
export async function deleteTrack(trackId: string) {
  const t = await db.track.findUnique({ where: { id: trackId }, include: { assets: true } });
  if (!t) return;
  await db.track.delete({ where: { id: trackId } });
  await releaseQuota(t.ownerId, t.sizeBytes + t.assets.reduce((s, a) => s + a.sizeBytes, 0n));
  await Promise.all([t.audioKey, t.coverKey, ...t.assets.map((a) => a.key)].map((k) => deleteObjectQuietly(k)));
}
