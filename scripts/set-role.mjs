#!/usr/bin/env node
/**
 * Changes a user's role from the command line (for instance operators).
 *
 *   npm run user:role -- <username> <USER|MODERATOR|ADMIN>
 *   docker compose exec app node scripts/set-role.mjs <username> <role>
 *
 * Plain JavaScript so it runs inside the production image without a build step.
 */
import { PrismaClient } from "@prisma/client";

const ROLES = ["USER", "MODERATOR", "ADMIN"];
const [username, role] = process.argv.slice(2);

if (!username || !ROLES.includes(role)) {
  console.error("Usage: set-role <username> <USER|MODERATOR|ADMIN>");
  process.exit(2);
}

const db = new PrismaClient();
try {
  const user = await db.user.findUnique({ where: { username: username.toLowerCase() } });
  if (!user) {
    console.error(`No user named "${username}".`);
    process.exitCode = 1;
  } else {
    await db.user.update({ where: { id: user.id }, data: { role } });
    console.log(`@${user.username}: ${user.role} -> ${role}`);
  }
} finally {
  await db.$disconnect();
}
