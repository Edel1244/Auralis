import type { NextRequest } from "next/server";
import { getAuth } from "@/server/auth/session";
import { db } from "@/server/db";
import { canViewTrack } from "@/server/modules/tracks/access";
import { streamObject } from "@/server/storage";
import { verifyMediaToken } from "@/server/security/crypto";

/**
 * Audio streaming with HTTP Range support (seeking, partial buffering).
 * Authorization: the session cookie (same-origin <audio>), or a short-lived
 * signed token (?t=) for contexts that cannot send cookies.
 * Private/removed audio is never reachable without permission: there are no
 * public URLs to stored audio objects.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/v1/tracks/[id]/stream">) {
  const { id } = await ctx.params;
  const viewer = (await getAuth(req))?.user ?? null;
  const track = await db.track.findUnique({
    where: { id },
    select: { id: true, ownerId: true, visibility: true, status: true, audioKey: true, assets: true },
  });
  if (!track) return new Response("Not found", { status: 404 });
  const signed = verifyMediaToken(track.audioKey, viewer?.id ?? null, req.nextUrl.searchParams.get("t"));
  const allowed = canViewTrack(track, viewer) || signed;
  // Moderators may review READY/REMOVED content; nobody streams FAILED/PROCESSING files except the owner.
  if (!allowed) return new Response("Not found", { status: 404 });

  const quality = req.nextUrl.searchParams.get("quality");
  const asset = quality && quality !== "original" ? track.assets.find((a) => a.quality === quality) : null;
  return streamObject(asset?.key ?? track.audioKey, req.headers.get("range"), {
    "cache-control": track.visibility === "PUBLIC" && track.status === "READY" ? "public, max-age=3600" : "private, no-store",
    "content-disposition": "inline",
    "x-content-type-options": "nosniff",
  });
}
