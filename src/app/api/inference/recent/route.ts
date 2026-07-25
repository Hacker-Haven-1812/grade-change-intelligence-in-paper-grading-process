import { db } from "@/lib/db";

/**
 * GET /api/inference/recent?limit=20
 * ----------------------------------
 * Returns the most recent persisted process samples (default 20, max 200)
 * for replay / debugging. Used by the dashboard when the WebSocket stream
 * reconnects and needs to backfill.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "20");
  const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? limitRaw : 20));

  try {
    const samples = await db.processSample.findMany({
      orderBy: { timestamp: "desc" },
      take: limit,
    });
    return Response.json(
      {
        count: samples.length,
        samples: samples
          .reverse()
          .map((s) => ({
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
    console.error("[/api/inference/recent] query failed:", err);
    return Response.json(
      { count: 0, samples: [], error: "db-unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
