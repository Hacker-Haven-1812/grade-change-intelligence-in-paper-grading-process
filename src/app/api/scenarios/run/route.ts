import { db } from "@/lib/db";
import {
  SCENARIO_RUN_SCHEMA,
  errorResponse,
  parseJsonBody,
  parseOk,
} from "@/lib/validation";

/**
 * POST /api/scenarios/run
 * -----------------------
 * Records the execution of a grade-change scenario. The dashboard calls
 * this when an operator clicks a scenario preset (start) and again when
 * the transition completes or is aborted (end).
 *
 * Body: SCENARIO_RUN_SCHEMA
 * Response: { id, scenario_id, outcome, started_at }
 */
export async function POST(req: Request) {
  const body = await parseJsonBody(req);
  if (body === null) {
    return errorResponse("BAD_JSON", "Invalid JSON body");
  }
  const parsed = SCENARIO_RUN_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Request body failed validation",
      parsed.error.issues
    );
  }
  const data = parsed.data;

  try {
    const row = await db.scenarioRun.create({
      data: {
        scenarioId: data.scenario_id,
        scenarioName: data.scenario_name,
        severity: data.severity,
        startStockFlow: data.start_stock_flow,
        startSteamPressure: data.start_steam_pressure,
        startMachineSpeed: data.start_machine_speed,
        endStockFlow: data.end_stock_flow ?? null,
        endSteamPressure: data.end_steam_pressure ?? null,
        endMachineSpeed: data.end_machine_speed ?? null,
        peakDeviationPct: data.peak_deviation_pct ?? null,
        stabilizationMin: data.stabilization_min ?? null,
        outcome: data.outcome ?? null,
      },
    });

    return Response.json(
      {
        id: row.id,
        scenario_id: row.scenarioId,
        outcome: row.outcome,
        started_at: row.startedAt.toISOString(),
        ended_at: row.endedAt?.toISOString() ?? null,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[/api/scenarios/run] persistence failed:", err);
    return errorResponse(
      "DB_WRITE_FAILED",
      "Failed to persist scenario run",
      { detail: String(err) },
      503
    );
  }
}

/**
 * GET /api/scenarios/run?limit=20
 * -------------------------------
 * Returns the most recent scenario executions — used by the historical
 * KPI / replays view.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "20");
  const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? limitRaw : 20));

  try {
    const runs = await db.scenarioRun.findMany({
      orderBy: { startedAt: "desc" },
      take: limit,
    });
    return Response.json(
      {
        count: runs.length,
        runs: runs.map((r) => ({
          id: r.id,
          scenario_id: r.scenarioId,
          scenario_name: r.scenarioName,
          severity: r.severity,
          started_at: r.startedAt.toISOString(),
          ended_at: r.endedAt?.toISOString() ?? null,
          start: {
            stock_flow: r.startStockFlow,
            steam_pressure: r.startSteamPressure,
            machine_speed: r.startMachineSpeed,
          },
          end:
            r.endStockFlow !== null
              ? {
                  stock_flow: r.endStockFlow,
                  steam_pressure: r.endSteamPressure,
                  machine_speed: r.endMachineSpeed,
                }
              : null,
          peak_deviation_pct: r.peakDeviationPct,
          stabilization_min: r.stabilizationMin,
          outcome: r.outcome,
          operator_id: r.operatorId,
          line_id: r.lineId,
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[/api/scenarios/run] query failed:", err);
    return Response.json(
      { count: 0, runs: [], error: "db-unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
