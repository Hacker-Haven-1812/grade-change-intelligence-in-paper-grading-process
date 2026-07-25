import { db } from "@/lib/db";
import {
  PROCESS_SAMPLE_SCHEMA,
  errorResponse,
  parseJsonBody,
  parseOk,
} from "@/lib/validation";

/**
 * POST /api/samples
 * -----------------
 * Ingests a single process sample (typically from the WebSocket QCS bridge
 * or an external DCS historian). Persists to the rolling 24h buffer.
 *
 * Body: PROCESS_SAMPLE_SCHEMA
 */
export async function POST(req: Request) {
  const body = await parseJsonBody(req);
  if (body === null) {
    return errorResponse("BAD_JSON", "Invalid JSON body");
  }
  const parsed = PROCESS_SAMPLE_SCHEMA.safeParse(body);
  if (!parseOk(parsed)) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Request body failed validation",
      parsed.error.issues
    );
  }
  const data = parsed.data;
  try {
    const row = await db.processSample.create({
      data: {
        stockFlow: data.stock_flow,
        fillerFlow: data.filler_flow,
        steamPressure: data.steam_pressure,
        machineSpeed: data.machine_speed,
        bwTarget: data.bw_target,
        actualBw: data.actual_bw,
        deviationPct: data.deviation_pct,
        isOffSpec: data.is_off_spec,
        riskProb: data.risk_prob,
        lineId: data.line_id,
      },
    });
    return Response.json(
      { id: row.id, persisted_at: row.timestamp.toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[/api/samples] persistence failed:", err);
    return errorResponse(
      "DB_WRITE_FAILED",
      "Failed to persist process sample",
      { detail: String(err) },
      503
    );
  }
}

/**
 * GET /api/samples?limit=60&since=ISO_DATE
 * ----------------------------------------
 * Returns the most recent samples, optionally filtered to those after a
 * given timestamp. Used by the dashboard for initial backfill on socket
 * reconnect.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "60");
  const limit = Math.max(1, Math.min(500, Number.isFinite(limitRaw) ? limitRaw : 60));
  const since = url.searchParams.get("since");

  try {
    const samples = await db.processSample.findMany({
      where: since ? { timestamp: { gt: new Date(since) } } : undefined,
      orderBy: { timestamp: "desc" },
      take: limit,
    });
    return Response.json(
      {
        count: samples.length,
        samples: samples.reverse().map((s) => ({
          id: s.id,
          timestamp: s.timestamp.toISOString(),
          stock_flow: s.stockFlow,
          filler_flow: s.fillerFlow,
          steam_pressure: s.steamPressure,
          machine_speed: s.machineSpeed,
          bw_target: s.bwTarget,
          actual_bw: s.actualBw,
          deviation_pct: s.deviationPct,
          is_off_spec: s.isOffSpec,
          risk_prob: s.riskProb,
          line_id: s.lineId,
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[/api/samples] query failed:", err);
    return Response.json(
      { count: 0, samples: [], error: "db-unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
