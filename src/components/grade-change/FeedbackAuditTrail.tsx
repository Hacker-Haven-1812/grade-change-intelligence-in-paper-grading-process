"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, History, ListChecks, XCircle } from "lucide-react";
import { useGradeChangeStore } from "@/hooks/useGradeChangeStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function FeedbackAuditTrail() {
  const log = useGradeChangeStore((s) => s.feedbackLog);

  const accepted = log.filter((e) => e.action === "Accepted").length;
  const rejected = log.length - accepted;
  const acceptanceRate = log.length > 0 ? Math.round((accepted / log.length) * 100) : 0;

  return (
    <section className="glass-panel flex h-full flex-col rounded-lg p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <ListChecks className="h-4 w-4 text-primary" />
            Operator Decision Audit Trail
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Every Accept/Reject is logged and fed back to the retraining loop
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">
            ✓ {accepted}
          </span>
          <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-red-300">
            ✕ {rejected}
          </span>
          <span className="rounded bg-primary/15 px-1.5 py-0.5 text-primary">
            {acceptanceRate}% accept
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1 max-h-80">
        {log.length === 0 ? (
          <div className="grid h-32 place-items-center rounded-md border border-dashed border-border/40 text-center text-xs text-muted-foreground">
            <div>
              <History className="mx-auto mb-1 h-5 w-5 opacity-50" />
              No decisions logged yet
              <div className="mt-0.5 text-[10px] opacity-70">
                Accept or reject a recommendation to start the feedback loop
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 pr-2">
            <AnimatePresence initial={false}>
              {log.map((entry) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -8, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: "auto" }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    "rounded-md border p-2.5 font-mono text-[11px]",
                    entry.action === "Accepted"
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-red-500/30 bg-red-500/5"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {entry.action === "Accepted" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-red-400" />
                      )}
                      <span className="font-semibold text-foreground">{entry.action}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleTimeString("en-GB", { hour12: false })}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-bold",
                        entry.risk_prob > 0.5
                          ? "bg-red-500/20 text-red-300"
                          : "bg-emerald-500/20 text-emerald-300"
                      )}
                    >
                      risk {(entry.risk_prob * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                    <span>
                      stock: <span className="text-foreground/90">{entry.inputs_snapshot.stock_flow.toFixed(0)} L/min</span>
                    </span>
                    <span>
                      steam: <span className="text-foreground/90">{entry.inputs_snapshot.steam_pressure.toFixed(1)} bar</span>
                    </span>
                    <span>
                      speed: <span className="text-foreground/90">{entry.inputs_snapshot.machine_speed.toFixed(0)} m/min</span>
                    </span>
                    <span>
                      filler: <span className="text-foreground/90">{entry.inputs_snapshot.filler_flow.toFixed(1)} L/min</span>
                    </span>
                  </div>
                  {entry.reject_reason && (
                    <div className="mt-1.5 flex items-center gap-1 rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-300">
                      <span className="opacity-70">Reason:</span>
                      <span className="font-semibold">{entry.reject_reason}</span>
                    </div>
                  )}
                  {entry.applied_stock_flow !== undefined && (
                    <div className="mt-1.5 flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">
                      <span className="opacity-70">Applied:</span>
                      <span className="font-semibold">stock → {entry.applied_stock_flow.toFixed(1)} L/min</span>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>
    </section>
  );
}
