import { GRADE_SCENARIOS } from "@/lib/gradeChangeEngine";

/**
 * GET /api/scenarios
 * ------------------
 * Returns the canonical list of grade-change scenario presets. Single source
 * of truth — the dashboard, the WebSocket mini-service, and any external
 * orchestrator all read from here.
 */
export async function GET() {
  return Response.json(
    {
      count: GRADE_SCENARIOS.length,
      scenarios: GRADE_SCENARIOS.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        severity: s.severity,
        inputs: s.inputs,
      })),
    },
    { headers: { "Cache-Control": "public, max-age=60" } }
  );
}
