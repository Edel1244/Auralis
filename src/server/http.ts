import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { Prisma } from "@prisma/client";
import { logger } from "./logger";

export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "SUSPENDED"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA: 415,
  RATE_LIMITED: 429,
  QUOTA_EXCEEDED: 507,
  SUSPENDED: 403,
  INTERNAL: 500,
};

/** Error that is safe to show to the client. */
export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: unknown,
    public headers?: Record<string, string>,
  ) {
    super(message);
  }
}

export const notFound = (what = "Resource") => new ApiError("NOT_FOUND", `${what} not found`);
export const forbidden = (msg = "You do not have permission to do that") => new ApiError("FORBIDDEN", msg);

/** JSON.stringify replacer: BigInt → number (sizes never exceed 2^53), Date → ISO. */
function replacer(_k: string, v: unknown) {
  return typeof v === "bigint" ? Number(v) : v;
}

export function json(data: unknown, init?: ResponseInit) {
  return new NextResponse(JSON.stringify(data, replacer), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers ?? {}) },
  });
}

function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: STATUS[err.code], headers: err.headers },
    );
  }
  if (err instanceof ZodError) {
    return json(
      {
        error: {
          code: "VALIDATION",
          message: err.issues[0]?.message ?? "Invalid input",
          details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
      },
      { status: 422 },
    );
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return json({ error: { code: "CONFLICT", message: "Already exists" } }, { status: 409 });
    if (err.code === "P2025") return json({ error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
  }
  logger.error("unhandled_api_error", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  return json({ error: { code: "INTERNAL", message: "Internal server error" } }, { status: 500 });
}

/**
 * CSRF defense in depth: session cookies are SameSite=Lax, and every state-changing
 * request carrying an Origin header must come from this app's own origin.
 */
function assertSameOrigin(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError("FORBIDDEN", "Invalid origin");
  }
  if (originHost !== host) throw new ApiError("FORBIDDEN", "Cross-origin request rejected");
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response> | Response;

/** Wraps a route handler with origin checks and uniform error handling. */
export function route<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      assertSameOrigin(req);
      return await fn(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function readJson<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError("BAD_REQUEST", "Request body must be valid JSON");
  }
  return schema.parse(body);
}

export function readQuery<T>(req: NextRequest, schema: ZodType<T>): T {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
}

export function clientIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

/** Standard offset pagination: ?page=1&limit=20 (limit capped at 50). */
export function pagination(req: NextRequest, defaultLimit = 20) {
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export function paged<T>(items: T[], total: number, p: { page: number; limit: number }) {
  return { items, page: p.page, limit: p.limit, total, hasMore: p.page * p.limit < total };
}
