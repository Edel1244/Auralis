import { z } from "zod";
import { route, json, readJson } from "@/server/http";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/server/db";
import { privacySchema } from "@/lib/validation";
import { isLocale } from "@/i18n/config";
import { privacyOf } from "@/server/modules/users/dto";
import type { Prisma } from "@prisma/client";

// Free-form JSON blobs are bounded in size and shape to keep them safe to store.
const jsonBlob = z
  .record(z.string().max(64), z.unknown())
  .refine((v) => JSON.stringify(v).length < 16_000, "Preferences payload too large");

const schema = z.object({
  appearance: jsonBlob.optional(),
  playback: jsonBlob.optional(),
  equalizer: jsonBlob.optional(),
  activeThemeId: z.string().max(40).nullable().optional(),
  locale: z.string().refine(isLocale, "Unsupported locale").optional(),
  privacy: privacySchema.optional(),
});

export const PATCH = route(async (req) => {
  const { user } = await requireAuth(req);
  const input = await readJson(req, schema);
  const { locale, privacy, ...prefs } = input;
  if (locale || privacy) {
    const { isPrivate, ...flags } = privacy ?? {};
    await db.user.update({
      where: { id: user.id },
      data: {
        ...(locale ? { locale } : {}),
        ...(isPrivate !== undefined ? { isPrivate } : {}),
        ...(Object.keys(flags).length ? { privacy: { ...privacyOf(user), ...flags } } : {}),
      },
    });
  }
  const data = {
    appearance: prefs.appearance as Prisma.InputJsonObject | undefined,
    playback: prefs.playback as Prisma.InputJsonObject | undefined,
    equalizer: prefs.equalizer as Prisma.InputJsonObject | undefined,
    activeThemeId: prefs.activeThemeId,
  };
  const pref = await db.userPreference.upsert({
    where: { userId: user.id },
    create: { ...data, userId: user.id },
    update: data,
  });
  return json({ preferences: pref });
});
