import { db } from "@/lib/db";

/**
 * GET /api/metrics?limit=50
 * -------------------------
 * Returns the historical model-quality trend — one row per retrain cycle.
 * Powers the "Model retraining history" chart in the Engine Status panel.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "50");
  const limit = Math.max(1, Math.min(500, Number.isFinite(limitRaw) ? limitRaw : 50));

  try {
    const metrics = await db.modelMetric.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return Response.json(
      {
        count: metrics.length,
        metrics: metrics
          .reverse()
          .map((m) => ({
            id: m.id,
            retrain_count: m.retrainCount,
            auc: m.auc,
            precision: m.precision,
            recall: m.recall,
            f1: m.f1,
            training_samples: m.trainingSamples,
            feedback_samples: m.feedbackSamples,
            feature_importance: JSON.parse(m.featureImportance),
            created_at: m.createdAt.toISOString(),
          })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[/api/metrics] query failed:", err);
    return Response.json(
      { count: 0, metrics: [], error: "db-unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
