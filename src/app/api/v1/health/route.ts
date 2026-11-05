import { db } from "@/server/db";
import { jobStats } from "@/server/jobs/queue";

/** Liveness/readiness probe for containers and uptime monitors (no sensitive data). */
export async function GET() {
  const started = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json(
      { status: "ok", db: "ok", dbLatencyMs: Date.now() - started, jobs: jobStats(), version: process.env.npm_package_version ?? null },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json({ status: "error", db: "unreachable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
