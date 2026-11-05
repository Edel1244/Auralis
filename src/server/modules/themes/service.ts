import "server-only";
import type { Prisma, Theme, User } from "@prisma/client";
import { z } from "zod";
import { themeTokensSchema } from "@/theme/tokens";
import { toUserRef } from "../users/dto";

export const themeInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(500).default(""),
  // Tokens are strictly validated (hex colors, enums, ranges): nothing free-form reaches CSS.
  tokens: themeTokensSchema,
  isPublic: z.boolean().default(false),
});

export const themeInclude = {
  author: { select: { id: true, username: true, displayName: true, avatarKey: true } },
} satisfies Prisma.ThemeInclude;

export function toTheme(t: Theme & { author: Pick<User, "id" | "username" | "displayName" | "avatarKey"> }, installed?: boolean) {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    tokens: themeTokensSchema.parse(t.tokens),
    isPublic: t.isPublic,
    installs: t.installs,
    author: toUserRef(t.author),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    installed,
  };
}
