import { z } from "zod";
import { route, json, readJson, ApiError } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/server/db";

const gains = z.array(z.number().min(-12).max(12)).length(10);

/** The user's custom equalizer presets. */
export const GET = route(async (req) => {
  const { user } = await requireAuth(req);
  const items = await db.eqPreset.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  return json({ items: items.map((p) => ({ id: p.id, name: p.name, gains: p.gains })) });
});

/** Creates or overwrites (by name) a preset. */
export const POST = route(async (req) => {
  const { user } = await requireAuth(req);
  const input = await readJson(req, z.object({ name: z.string().trim().min(1).max(40), gains }));
  if ((await db.eqPreset.count({ where: { userId: user.id } })) >= 50) throw new ApiError("BAD_REQUEST", "Preset limit reached (50)");
  const p = await db.eqPreset.upsert({
    where: { userId_name: { userId: user.id, name: input.name } },
    create: { userId: user.id, ...input },
    update: { gains: input.gains },
  });
  return json({ preset: { id: p.id, name: p.name, gains: p.gains } }, { status: 201 });
});

export const DELETE = route(async (req) => {
  const { user } = await requireAuth(req);
  const { id } = await readJson(req, z.object({ id: z.string().max(40) }));
  await db.eqPreset.deleteMany({ where: { id, userId: user.id } });
  return json({ ok: true });
});
