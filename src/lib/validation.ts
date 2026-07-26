import { z } from "zod";

/**
 * Server-side input validation schemas for the GradeChange AI API.
 * Every API route parses its body / query against one of these — invalid
 * input is rejected with a 400 and a structured error before it can reach
 * the engine or the database.
 */

export const PROCESS_INPUTS_SCHEMA = z.object({
  stock_flow: z
    .number()
    .min(100, "stock_flow must be ≥ 100 L/min")
    .max(200, "stock_flow must be ≤ 200 L/min"),
  filler_flow: z
    .number()
    .min(10, "filler_flow must be ≥ 10 L/min")
    .max(50, "filler_flow must be ≤ 50 L/min"),
  steam_pressure: z
    .number()
    .min(2.0, "steam_pressure must be ≥ 2.0 bar")
    .max(5.0, "steam_pressure must be ≤ 5.0 bar"),
  machine_speed: z
    .number()
    .min(300, "machine_speed must be ≥ 300 m/min")
    .max(800, "machine_speed must be ≤ 800 m/min"),
});

export const REJECT_REASONS = [
  "Unsafe local condition",
  "Equipment constraint",
  "Operator judgement",
  "Recipe override",
  "Sensor drift suspected",
] as const;

export const FEEDBACK_SCHEMA = z.object({
  recommendation_id: z.string().min(1),
  action: z.enum(["Accepted", "Rejected"]),
  reject_reason: z.enum(REJECT_REASONS).optional(),
  note: z.string().max(500).optional(),
  inputs_snapshot: PROCESS_INPUTS_SCHEMA,
  risk_prob: z.number().min(0).max(1),
  bw_target: z.number(),
  actual_bw: z.number(),
  deviation_pct: z.number().min(0),
  is_off_spec: z.boolean(),
  suggested_stock_flow: z.number().optional(),
  suggested_machine_speed: z.number().optional(),
  applied_stock_flow: z.number().optional(),
  applied_machine_speed: z.number().optional(),
  operator_id: z.string().max(64).default("operator-1"),
  line_id: z.string().max(32).default("PM-04"),
});

/**
 * Conditional validation: reject_reason is required when action is Rejected.
 * Kept as a separate function (rather than .refine on the schema) so the
 * schema remains a plain ZodObject — its safeParse result type
 * interoperates cleanly with callers.
 */
export function validateFeedbackReasoning(data: z.infer<typeof FEEDBACK_SCHEMA>): string | null {
  if (!data) return "feedback payload is empty";
  if (data.action === "Rejected" && !data.reject_reason) {
    return "reject_reason is required when action is Rejected";
  }
  return null;
}

export const SCENARIO_RUN_SCHEMA = z.object({
  scenario_id: z.string().min(1),
  scenario_name: z.string().min(1),
  severity: z.enum(["stable", "warning", "critical"]),
  start_stock_flow: z.number(),
  start_steam_pressure: z.number(),
  start_machine_speed: z.number(),
  end_stock_flow: z.number().optional(),
  end_steam_pressure: z.number().optional(),
  end_machine_speed: z.number().optional(),
  peak_deviation_pct: z.number().optional(),
  stabilization_min: z.number().optional(),
  outcome: z.enum(["within-spec", "off-spec", "aborted"]).optional(),
});

export const PROCESS_SAMPLE_SCHEMA = z.object({
  stock_flow: z.number(),
  filler_flow: z.number(),
  steam_pressure: z.number(),
  machine_speed: z.number(),
  bw_target: z.number(),
  actual_bw: z.number(),
  deviation_pct: z.number(),
  is_off_spec: z.boolean(),
  risk_prob: z.number(),
  line_id: z.string().max(32).default("PM-04"),
});

export type ProcessInputsDTO = z.infer<typeof PROCESS_INPUTS_SCHEMA>;
export type FeedbackDTO = z.infer<typeof FEEDBACK_SCHEMA>;
export type ScenarioRunDTO = z.infer<typeof SCENARIO_RUN_SCHEMA>;
export type ProcessSampleDTO = z.infer<typeof PROCESS_SAMPLE_SCHEMA>;

/**
 * Standardised JSON error envelope returned by all API routes.
 */
export function errorResponse(
  code: string,
  message: string,
  details?: unknown,
  status = 400
) {
  return Response.json(
    { error: { code, message, details } },
    { status }
  );
}

/**
 * Parses a JSON request body. Returns null on JSON parse failure (caller
 * should turn that into a BAD_JSON 400).
 */
export async function parseJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/**
 * Type guard: returns true iff zod's safeParse succeeded AND data is non-null.
 * Use this in every route handler so we never accidentally destructure
 * `undefined` from a successful parse.
 */
export function parseOk<T>(
  result: { success: boolean; data?: T }
): result is { success: true; data: T } {
  return result.success === true && result.data !== undefined;
}
