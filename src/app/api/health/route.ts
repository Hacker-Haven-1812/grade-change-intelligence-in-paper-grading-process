import { NextResponse } from "next/server";
import { dbHealthy } from "@/lib/db";

/**
 * GET /api/health
 * Lightweight liveness probe — no DB work beyond a count, no payload beyond
 * a status string. Suitable for Kubernetes liveness/readiness checks.
 */
export async function GET() {
  const dbOk = await dbHealthy();
  const status = dbOk ? "ok" : "degraded";
  return NextResponse.json(
    { status, db: dbOk ? "ok" : "degraded", ts: Date.now() },
    {
      status: dbOk ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
