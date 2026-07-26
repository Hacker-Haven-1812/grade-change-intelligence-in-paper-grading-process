import { PrismaClient, type Prisma } from "@prisma/client";

/**
 * Hardened Prisma singleton.
 *
 * - Reuses a single client across hot-reloads in dev to avoid leaking
 *   connections (a common Next.js footgun).
 * - Logs only warnings/errors in production; query logging is opt-in via
 *   the `DEBUG=prisma:query` env var.
 * - Exposes a `healthy()` helper used by the `/api/health` route.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const queryLogging: Prisma.LogLevel[] =
  process.env.DEBUG?.includes("prisma:query")
    ? ["query", "warn", "error"]
    : ["warn", "error"];

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: queryLogging,
    errorFormat: "colorless",
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

/**
 * Lightweight DB connectivity probe. Used by `/api/health` so the dashboard
 * can surface a "DATABASE: OK / DEGRADED" pill.
 */
export async function dbHealthy(): Promise<boolean> {
  try {
    // 1s timeout — we don't want the health check to hang the dashboard.
    const result = await Promise.race([
      db.feedbackLog.count({ take: 0 }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("db-health-timeout")), 1000)
      ),
    ]);
    return typeof result === "number";
  } catch {
    return false;
  }
}
