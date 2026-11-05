import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { Role, User } from "@prisma/client";
import { db } from "../db";
import { ApiError } from "../http";
import { randomToken, sha256 } from "../security/crypto";

export const SESSION_COOKIE = "auralis_session";
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;
const REFRESH_AFTER_MS = 24 * 3600 * 1000;

export type AuthContext = { user: User; sessionId: string };

const ROLE_RANK: Record<Role, number> = { USER: 0, MODERATOR: 1, ADMIN: 2 };
export const hasRole = (user: Pick<User, "role">, role: Role) => ROLE_RANK[user.role] >= ROLE_RANK[role];

export async function createSession(userId: string, meta: { userAgent?: string | null; ip?: string | null }) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
      ip: meta.ip ?? null,
    },
  });
  return { token, expiresAt };
}

export function setSessionCookie(res: NextResponse, token: string, expiresAt: Date) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "lax" });
}

async function resolveToken(token: string | undefined): Promise<AuthContext | null> {
  if (!token || token.length > 200) return null;
  const session = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  // Lift expired temporary suspensions.
  if (session.user.status === "SUSPENDED" && session.user.suspendedUntil && session.user.suspendedUntil.getTime() < now) {
    session.user = await db.user.update({
      where: { id: session.user.id },
      data: { status: "ACTIVE", suspendedUntil: null },
    });
  }
  if (session.user.status === "BANNED") return null;
  // Sliding expiration.
  if (now - session.lastUsedAt.getTime() > REFRESH_AFTER_MS) {
    await db.session
      .update({ where: { id: session.id }, data: { lastUsedAt: new Date(), expiresAt: new Date(now + SESSION_TTL_MS) } })
      .catch(() => {});
  }
  return { user: session.user, sessionId: session.id };
}

const requestCache = new WeakMap<NextRequest, Promise<AuthContext | null>>();

/** Authenticated user for an API request, or null. Memoized per request. */
export function getAuth(req: NextRequest): Promise<AuthContext | null> {
  let p = requestCache.get(req);
  if (!p) {
    p = resolveToken(req.cookies.get(SESSION_COOKIE)?.value);
    requestCache.set(req, p);
  }
  return p;
}

/** For Server Components / layouts. */
export async function getServerAuth(): Promise<AuthContext | null> {
  const store = await cookies();
  return resolveToken(store.get(SESSION_COOKIE)?.value);
}

/**
 * Requires a logged-in, non-suspended user. Suspended users may still read
 * (GET) but cannot change anything.
 */
export async function requireAuth(req: NextRequest): Promise<AuthContext> {
  const auth = await getAuth(req);
  if (!auth) throw new ApiError("UNAUTHENTICATED", "You need to log in");
  if (auth.user.status === "SUSPENDED" && req.method !== "GET") {
    throw new ApiError("SUSPENDED", "Your account is suspended");
  }
  return auth;
}

export async function requireRole(req: NextRequest, role: Role): Promise<AuthContext> {
  const auth = await requireAuth(req);
  if (!hasRole(auth.user, role)) throw new ApiError("FORBIDDEN", "Insufficient permissions");
  return auth;
}
