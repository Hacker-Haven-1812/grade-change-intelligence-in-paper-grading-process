import { db } from "@/lib/db";

/**
 * GET /api/feedback/stats
 * -----------------------
 * Aggregated KPIs over the entire audit trail — used by the dashboard's
 * "Engine Status" panel and by the retraining trend chart.
 */
export async function GET() {
  try {
    const [total, accepted, rejected, retrainCount, lastRetrain] = await Promise.all([
      db.feedbackLog.count(),
      db.feedbackLog.count({ where: { action: "Accepted" } }),
      db.feedbackLog.count({ where: { action: "Rejected" } }),
      db.modelMetric.count(),
      db.modelMetric.findFirst({ orderBy: { createdAt: "desc" } }),
    ]);

    const acceptanceRate = total > 0 ? accepted / total : 0;

    // Reject-reason breakdown for the root-cause chart
    const rejectReasonsRaw = await db.feedbackLog.groupBy({
      by: ["rejectReason"],
      where: { action: "Rejected" },
      _count: { _all: true },
    });
    const rejectBreakdown = rejectReasonsRaw
      .filter((r) => r.rejectReason !== null)
      .map((r) => ({ reason: r.rejectReason, count: r._count._all }));

    return Response.json(
      {
        total,
        accepted,
        rejected,
        acceptance_rate: acceptanceRate,
        retraining_count: retrainCount,
        last_retrained_at: lastRetrain?.createdAt.toISOString() ?? null,
        last_metric: lastRetrain
          ? {
              auc: lastRetrain.auc,
              precision: lastRetrain.precision,
              recall: lastRetrain.recall,
              f1: lastRetrain.f1,
              training_samples: lastRetrain.trainingSamples,
              feedback_samples: lastRetrain.feedbackSamples,
            }
          : null,
        reject_breakdown: rejectBreakdown,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[/api/feedback/stats] query failed:", err);
    return Response.json(
      {
        total: 0,
        accepted: 0,
        rejected: 0,
        acceptance_rate: 0,
        retraining_count: 0,
        last_retrained_at: null,
        last_metric: null,
        reject_breakdown: [],
        error: "db-unavailable",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
