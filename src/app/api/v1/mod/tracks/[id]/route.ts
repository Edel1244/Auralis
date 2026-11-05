import { z } from "zod";
import { route, json, readJson } from "@/server/http";
import { requireRole } from "@/server/auth/session";
import { removeTrack, restoreTrack } from "@/server/modules/moderation/service";

type Ctx = RouteContext<"/api/v1/mod/tracks/[id]">;

/** Direct moderation of an upload (e.g. from the uploads review queue). */
export const POST = route<Ctx>(async (req, ctx) => {
  const { user } = await requireRole(req, "MODERATOR");
  const { action, reason, strike } = await readJson(
    req,
    z.object({ action: z.enum(["remove", "restore"]), reason: z.string().trim().max(300).default(""), strike: z.boolean().default(false) }),
  );
  const id = (await ctx.params).id;
  if (action === "remove") await removeTrack(user, id, reason || "Removed by moderators", { strike });
  else await restoreTrack(user, id, reason);
  return json({ ok: true });
});
