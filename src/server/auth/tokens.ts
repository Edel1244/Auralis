import "server-only";
import type { TokenType } from "@prisma/client";
import { db } from "../db";
import { randomToken, sha256 } from "../security/crypto";

const TTL: Record<TokenType, number> = {
  EMAIL_VERIFY: 48 * 3600 * 1000,
  PASSWORD_RESET: 60 * 60 * 1000,
};

/** Issues a single-use token, invalidating earlier unused tokens of the same type. */
export async function issueToken(userId: string, type: TokenType) {
  const token = randomToken(32);
  await db.$transaction([
    db.verificationToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } }),
    db.verificationToken.create({
      data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + TTL[type]) },
    }),
  ]);
  return token;
}

/** Atomically consumes a token. Returns the userId or null when invalid/expired/used. */
export async function consumeToken(token: string, type: TokenType) {
  const record = await db.verificationToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record || record.type !== type || record.usedAt || record.expiresAt < new Date()) return null;
  const { count } = await db.verificationToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  return count === 1 ? record.userId : null;
}
