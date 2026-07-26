import {
  buildRecommendation,
  generateProcessState,
  type ProcessInputs,
} from "@/lib/gradeChangeEngine";
import {
  PROCESS_INPUTS_SCHEMA,
  errorResponse,
  parseJsonBody,
  parseOk,
} from "@/lib/validation";
import { db } from "@/lib/db";

/**
 * POST /api/inference
 * -------------------
 * Runs the full inference pipeline (risk classifier + SHAP + setpoint
 * optimizer + source tagging) against the supplied process inputs and
 * returns the recommendation. Also persists a ProcessSample row so the
 * 24h replay buffer stays current.
 *
 * Body: ProcessInputs
 * Response: { recommendation, sample, db_persisted }
 */
export async function POST(req: Request) {
  const body = await parseJsonBody(req);
  if (body === null) {
    return errorResponse("BAD_JSON", "Invalid JSON body");
  }
  const parsed = PROCESS_INPUTS_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Request body failed validation",
      parsed.error.issues
    );
  }
  const inputs = parsed.data as ProcessInputs;
  const state = generateProcessState(inputs);
  const recommendation = buildRecommendation(inputs);

  let dbPersisted = false;
  try {
    await db.processSample.create({
      data: {
        stockFlow: state.stock_flow,
        fillerFlow: state.filler_flow,
        steamPressure: state.steam_pressure,
        machineSpeed: state.machine_speed,
        bwTarget: state.bw_target,
        actualBw: state.actual_bw,
        deviationPct: state.deviation_pct,
        isOffSpec: state.is_off_spec,
        riskProb: recommendation.risk_prob,
      },
    });
    dbPersisted = true;
  } catch (err) {
    // Don't fail the request — the engine result is still valid. The health
    // probe will surface the DB degradation separately.
    console.error("[/api/inference] process sample persistence failed:", err);
  }

  return Response.json(
    {
      recommendation,
      sample: state,
      db_persisted: dbPersisted,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * GET /api/inference
 * ------------------
 * Convenience endpoint: runs inference against the current default inputs
 * (the last persisted sample, or the recipe default if none) so external
 * callers can do a quick smoke test without constructing a body.
 */
export async function GET() {
  let inputs: ProcessInputs = {
    stock_flow: 150,
    filler_flow: 25,
    steam_pressure: 3.5,
    machine_speed: 550,
  };
  try {
    const last = await db.processSample.findFirst({
      orderBy: { timestamp: "desc" },
    });
    if (last) {
      inputs = {
        stock_flow: last.stockFlow,
        filler_flow: last.fillerFlow,
        steam_pressure: last.steamPressure,
        machine_speed: last.machineSpeed,
      };
    }
  } catch (err) {
    console.error("[/api/inference] GET last-sample lookup failed:", err);
  }

  const recommendation = buildRecommendation(inputs);
  return Response.json(
    { inputs, recommendation },
    { headers: { "Cache-Control": "no-store" } }
  );
}

// Re-export errorResponse for testing ergonomics
export { errorResponse };
