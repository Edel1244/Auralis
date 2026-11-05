import { route, json } from "@/server/http";
import { getAuth } from "@/server/auth/session";
import { toMe } from "@/server/modules/users/dto";
import { db } from "@/server/db";

export const GET = route(async (req) => {
  const auth = await getAuth(req);
  if (!auth) return json({ user: null, preferences: null });
  const pref = await db.userPreference.upsert({
    where: { userId: auth.user.id },
    create: { userId: auth.user.id },
    update: {},
  });
  return json(
    {
      user: toMe(auth.user),
      preferences: { appearance: pref.appearance, playback: pref.playback, equalizer: pref.equalizer, activeThemeId: pref.activeThemeId },
    },
    { headers: { "cache-control": "no-store" } },
  );
});
