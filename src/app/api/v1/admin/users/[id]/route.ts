import { z } from "zod";
import { route, json, readJson, notFound, forbidden, ApiError } from "@/server/http";
import { hasRole, requireRole } from "@/server/auth/session";
import { db } from "@/server/db";
import { assertCanModerateUser, suspendUser } from "@/server/modules/moderation/service";
import { logModeration } from "@/server/modules/moderation/audit";
import { notify } from "@/server/modules/notifications/notify";

type Ctx = RouteContext<"/api/v1/admin/users/[id]">;

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("suspend"), days: z.number().int().min(1).max(365), reason: z.string().trim().max(500).default("") }),
  z.object({ action: z.literal("unsuspend"), reason: z.string().trim().max(500).default("") }),
  z.object({ action: z.literal("ban"), reason: z.string().trim().max(500).default("") }),
  z.object({ action: z.literal("unban"), reason: z.string().trim().max(500).default("") }),
  z.object({ action: z.literal("setRole"), role: z.enum(["USER", "MODERATOR", "ADMIN"]) }),
  z.object({ action: z.literal("setQuota"), quotaMb: z.number().int().min(0).max(10_000_000) }),
  z.object({ action: z.literal("clearStrikes") }),
]);

const ADMIN_ONLY = new Set(["ban", "unban", "setRole", "setQuota", "clearStrikes"]);

/**
 * Account management. Every action is authorized here on the server
 * (moderators: suspend/unsuspend regular users; admins: everything) and audited.
 */
export const POST = route<Ctx>(async (req, ctx) => {
  const { user: actor } = await requireRole(req, "MODERATOR");
  const target = await db.user.findUnique({ where: { id: (await ctx.params).id } });
  if (!target) throw notFound("User");
  const input = await readJson(req, schema);
  if (ADMIN_ONLY.has(input.action) && !hasRole(actor, "ADMIN")) throw forbidden("Administrators only");

  switch (input.action) {
    case "suspend":
      await suspendUser(actor, target, input.days, input.reason);
      break;
    case "unsuspend":
      assertCanModerateUser(actor, target);
      await db.user.update({ where: { id: target.id }, data: { status: "ACTIVE", suspendedUntil: null } });
      await logModeration(actor.id, "user.unsuspend", "USER", target.id, input.reason);
      await notify(target.id, "account_status", { status: "ACTIVE" });
      break;
    case "ban":
      assertCanModerateUser(actor, target);
      await db.$transaction([
        db.user.update({ where: { id: target.id }, data: { status: "BANNED", suspendedUntil: null } }),
        db.session.deleteMany({ where: { userId: target.id } }), // sign out everywhere
        // Banned users' public content disappears from listings via the BANNED owner filters.
      ]);
      await logModeration(actor.id, "user.ban", "USER", target.id, input.reason);
      break;
    case "unban":
      assertCanModerateUser(actor, target);
      await db.user.update({ where: { id: target.id }, data: { status: "ACTIVE" } });
      await logModeration(actor.id, "user.unban", "USER", target.id, input.reason);
      break;
    case "setRole": {
      if (target.id === actor.id) throw new ApiError("FORBIDDEN", "You cannot change your own role");
      if (target.role === "ADMIN" && input.role !== "ADMIN" && (await db.user.count({ where: { role: "ADMIN", status: "ACTIVE" } })) <= 1) {
        throw new ApiError("CONFLICT", "At least one active administrator is required");
      }
      await db.user.update({ where: { id: target.id }, data: { role: input.role } });
      await logModeration(actor.id, "user.role", "USER", target.id, "", { from: target.role, to: input.role });
      break;
    }
    case "setQuota":
      await db.user.update({ where: { id: target.id }, data: { storageQuotaBytes: BigInt(input.quotaMb) * 1024n * 1024n } });
      await logModeration(actor.id, "user.quota", "USER", target.id, "", { quotaMb: input.quotaMb });
      break;
    case "clearStrikes":
      await db.user.update({ where: { id: target.id }, data: { strikeCount: 0 } });
      await logModeration(actor.id, "user.strikes.clear", "USER", target.id, "", { previous: target.strikeCount });
      break;
  }
  return json({ ok: true });
});
