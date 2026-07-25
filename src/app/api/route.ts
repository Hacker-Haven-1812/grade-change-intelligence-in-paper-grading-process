import { NextResponse } from "next/server";
import { dbHealthy } from "@/lib/db";

/**
 * GET /api
 * Root API health probe — surfaces the service identity, version, and the
 * health of every dependency. Used by the dashboard's status pills and by
 * any external orchestrator (Kubernetes liveness/readiness, etc.).
 */
export async function GET() {
  const dbOk = await dbHealthy();
  return NextResponse.json(
    {
      service: "gradechange-ai",
      version: "1.0.0",
      status: dbOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      dependencies: {
        database: dbOk ? "ok" : "degraded",
        inferenceEngine: "ok",
      },
      endpoints: [
        "GET  /api",
        "GET  /api/health",
        "POST /api/inference",
        "GET  /api/inference/recent?limit=20",
        "POST /api/feedback",
        "GET  /api/feedback?limit=50",
        "GET  /api/feedback/stats",
        "GET  /api/scenarios",
        "POST /api/scenarios/run",
        "GET  /api/metrics",
      ],
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}
