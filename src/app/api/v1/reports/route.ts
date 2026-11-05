import { z } from "zod";
import { route, json, readJson, notFound, ApiError } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { rateLimit } from "@/server/security/rate-limit";
import { db } from "@/server/db";

const schema = z.object({
  targetType: z.enum(["TRACK", "ALBUM", "PLAYLIST", "USER", "COMMENT", "THEME"]),
  targetId: z.string().min(1).max(40),
  reason: z.enum(["COPYRIGHT", "SPAM", "ABUSE", "EXPLICIT_UNLABELED", "IMPERSONATION", "OTHER"]),
  details: z.string().trim().max(2000).default(""),
});

async function targetExists(type: z.infer<typeof schema>["targetType"], id: string) {
  const where = { where: { id }, select: { id: true } };
  switch (type) {
    case "TRACK": return db.track.findUnique(where);
    case "ALBUM": return db.album.findUnique(where);
    case "PLAYLIST": return db.playlist.findUnique(where);
    case "USER": return db.user.findUnique(where);
    case "COMMENT": return db.comment.findUnique(where);
    case "THEME": return db.theme.findUnique(where);
  }
}

/** Files a content report for the moderation queue. One open report per user per target. */
export const POST = route(async (req) => {
  const { user } = await requireAuth(req);
  rateLimit(`report:${user.id}`, 20, 60 * 60 * 1000);
  const input = await readJson(req, schema);
  if (!(await targetExists(input.targetType, input.targetId))) throw notFound("Reported content");
  if (input.targetType === "USER" && input.targetId === user.id) throw new ApiError("BAD_REQUEST", "You cannot report yourself");
  const open = await db.report.findFirst({
    where: { reporterId: user.id, targetType: input.targetType, targetId: input.targetId, status: { in: ["OPEN", "REVIEWING"] } },
  });
  if (open) return json({ report: { id: open.id }, duplicate: true });
  const report = await db.report.create({ data: { ...input, reporterId: user.id } });
  return json({ report: { id: report.id } }, { status: 201 });
});
