import { route, json } from "@/server/http";
import { getAuth } from "@/server/auth/session";
import { toMe } from "@/server/modules/users/dto";
import { db } from "@/server/db";
import { devMailboxEnabled, emailDeliveryMode } from "@/server/mail";

/** Instance capabilities the UI needs to explain itself (no secrets). */
const instanceInfo = () => ({ emailDelivery: emailDeliveryMode(), devMailbox: devMailboxEnabled() });

export const GET = route(async (req) => {
  const auth = await getAuth(req);
  if (!auth) return json({ user: null, preferences: null, instance: instanceInfo() });
  const pref = await db.userPreference.upsert({
    where: { userId: auth.user.id },
    create: { userId: auth.user.id },
    update: {},
  });
  return json(
    {
      user: toMe(auth.user),
      preferences: { appearance: pref.appearance, playback: pref.playback, equalizer: pref.equalizer, activeThemeId: pref.activeThemeId },
      instance: instanceInfo(),
    },
    { headers: { "cache-control": "no-store" } },
  );
});
