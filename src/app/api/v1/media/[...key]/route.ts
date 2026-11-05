import type { NextRequest } from "next/server";
import { streamObject } from "@/server/storage";

/**
 * Public image delivery (avatars, banners, covers). Image keys contain an
 * unguessable random component. Audio is NOT served here — it goes through
 * /api/v1/tracks/:id/stream which enforces visibility rules.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/v1/media/[...key]">) {
  const { key } = await ctx.params;
  const joined = key.join("/");
  if (!joined.startsWith("images/") || !/^[a-zA-Z0-9/_.-]+$/.test(joined) || joined.includes("..")) {
    return new Response("Not found", { status: 404 });
  }
  return streamObject(joined, req.headers.get("range"), {
    "cache-control": "public, max-age=31536000, immutable",
  });
}
