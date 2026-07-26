"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  CheckCircle2,
  Database,
  Gauge,
  History,
  X,
  Zap,
  Clock,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { useGradeChangeStore } from "@/hooks/useGradeChangeStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RejectReason } from "@/lib/gradeChangeEngine";

const REJECT_REASONS: RejectReason[] = [
  "Unsafe local condition",
  "Equipment constraint",
  "Operator judgement",
  "Recipe override",
  "Sensor drift suspected",
];

export function RecommendationCard() {
  const rec = useGradeChangeStore((s) => s.recommendation);
  const accept = useGradeChangeStore((s) => s.acceptRecommendation);
  const reject = useGradeChangeStore((s) => s.rejectRecommendation);
  const retrainingProgress = useGradeChangeStore((s) => s.retrainingProgress);
  const lastRetrainedAt = useGradeChangeStore((s) => s.lastRetrainedAt);
  // Subscribe to inputs reactively — using getState() in render bypasses
  // Zustand's subscription and causes stale UI + hydration warnings.
  const currentStockFlow = useGradeChangeStore((s) => s.inputs.stock_flow);
  const currentMachineSpeed = useGradeChangeStore((s) => s.inputs.machine_speed);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [justAccepted, setJustAccepted] = useState(false);
  const [justRejected, setJustRejected] = useState(false);

  const isCritical = rec.risk_prob > 0.5;
  const tone = isCritical ? "red" : "emerald";

  const handleAccept = () => {
    accept();
    setJustAccepted(true);
    setTimeout(() => setJustAccepted(false), 2200);
  };

  const handleReject = (reason: RejectReason) => {
    reject(reason);
    setRejectOpen(false);
    setJustRejected(true);
    setTimeout(() => setJustRejected(false), 2200);
  };

  return (
    <section
      className={cn(
        "glass-panel relative overflow-hidden rounded-lg p-4",
        isCritical && "ring-1 ring-red-500/40"
      )}
    >
      {/* Critical pulse background */}
      {isCritical && (
        <motion.div
          initial={{ opacity: 0.3 }}
          animate={{ opacity: [0.15, 0.35, 0.15] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-red-500/10 via-transparent to-transparent"
        />
      )}

      <div className="relative">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Zap className={cn("h-4 w-4", isCritical ? "text-red-400" : "text-emerald-400")} />
            Setpoint Recommendation
          </h2>
          <span
            className={cn(
              "rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              isCritical
                ? "bg-red-500/20 text-red-300"
                : "bg-emerald-500/20 text-emerald-300"
            )}
          >
            {isCritical ? "Action Required" : "Hold Trajectory"}
          </span>
        </div>

        {/* Headline */}
        <motion.div
          key={rec.id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "mb-3 rounded-md border-l-2 p-3",
            isCritical
              ? "border-red-500 bg-red-500/5"
              : "border-emerald-500 bg-emerald-500/5"
          )}
        >
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Recommended Action
          </div>
          <div className="mt-1 text-sm font-semibold leading-snug text-foreground">
            {rec.headline}
          </div>
        </motion.div>

        {/* Adjustments grid */}
        <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
          <AdjustmentCell
            label="Stock Flow"
            current={currentStockFlow}
            suggested={rec.adjustments.suggested_stock_flow}
            unit="L/min"
            delta={rec.adjustments.stock_flow_delta}
          />
          <AdjustmentCell
            label="Machine Speed"
            current={currentMachineSpeed}
            suggested={rec.adjustments.suggested_machine_speed}
            unit="m/min"
            delta={rec.adjustments.machine_speed_delta}
          />
        </div>

        {/* Rationale */}
        <div className="mb-3 rounded-md bg-card/40 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <Gauge className="h-3 w-3" /> Rationale
          </div>
          <p className="text-xs leading-relaxed text-foreground/90">{rec.rationale}</p>
        </div>

        {/* Inference sources */}
        <div className="mb-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <Database className="h-3 w-3" /> Inference Sources
          </div>
          <div className="flex flex-wrap gap-1.5">
            {rec.sources.map((src, i) => (
              <SourceChip key={`${src.id}-${i}`} source={src} />
            ))}
          </div>
        </div>

        {/* Horizon + stabilization */}
        <div className="mb-4 flex items-center justify-between rounded-md border border-border/40 bg-background/30 px-3 py-2 text-[11px]">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3 w-3" />
            Horizon · <span className="font-mono text-foreground">{rec.adjustments.horizon_seconds}s</span>
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            Stabilization · <span className="font-mono text-foreground">{rec.adjustments.est_stabilization_min} min</span>
          </span>
        </div>

        {/* Accept / Reject buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handleAccept}
            disabled={justAccepted}
            className={cn(
              "h-11 border border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 hover:text-emerald-100",
              justAccepted && "opacity-70"
            )}
            variant="outline"
          >
            <AnimatePresence mode="wait" initial={false}>
              {justAccepted ? (
                <motion.span
                  key="ok"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" /> Applied
                </motion.span>
              ) : (
                <motion.span
                  key="accept"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center gap-1.5"
                >
                  <Check className="h-4 w-4" /> Accept
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
          <Button
            onClick={() => setRejectOpen(true)}
            disabled={justRejected}
            className={cn(
              "h-11 border border-red-500/40 bg-red-500/15 text-red-200 hover:bg-red-500/25 hover:text-red-100",
              justRejected && "opacity-70"
            )}
            variant="outline"
          >
            {justRejected ? (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Logged
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <X className="h-4 w-4" /> Reject
              </span>
            )}
          </Button>
        </div>

        {/* Retraining indicator */}
        {retrainingProgress < 100 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-3 overflow-hidden"
          >
            <div className="flex items-center gap-2 rounded-md bg-sky-500/10 px-3 py-2 text-[11px] text-sky-300">
              <RefreshCw className="h-3 w-3 animate-spin" />
              <span>Model retraining on accepted action · {Math.round(retrainingProgress)}%</span>
              <div className="ml-auto h-1 w-24 overflow-hidden rounded-full bg-sky-500/20">
                <motion.div
                  className="h-full bg-sky-400"
                  animate={{ width: `${retrainingProgress}%` }}
                />
              </div>
            </div>
          </motion.div>
        )}

        {lastRetrainedAt && retrainingProgress >= 100 && (
          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <RefreshCw className="h-3 w-3" />
            Last retrain: {formatRetrainTime(lastRetrainedAt)} · feedback loop active
          </div>
        )}
      </div>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="glass-panel border-border/60">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <X className="h-4 w-4 text-red-400" />
              Reject Recommendation
            </DialogTitle>
            <DialogDescription>
              Selecting a reason logs the rejection to the audit trail and weights the next
              retraining cycle. Pick the closest match.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            {REJECT_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => handleReject(r)}
                className="group flex w-full items-center justify-between rounded-md border border-border/50 bg-card/40 px-3 py-2.5 text-left text-xs transition-colors hover:border-red-500/50 hover:bg-red-500/10"
              >
                <span className="font-medium text-foreground">{r}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-red-300" />
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)} className="text-xs">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function AdjustmentCell({
  label,
  current,
  suggested,
  unit,
  delta,
}: {
  label: string;
  current: number;
  suggested: number;
  unit: string;
  delta: number;
}) {
  const isDelta = Math.abs(delta) > 0.01;
  const isDown = delta < 0;
  return (
    <div className="rounded-md border border-border/40 bg-background/30 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-mono text-sm font-bold tabular-nums text-foreground">
          {suggested.toFixed(suggested < 10 ? 1 : 0)}
        </span>
        <span className="text-[9px] text-muted-foreground">{unit}</span>
      </div>
      {isDelta ? (
        <div
          className={cn(
            "mt-0.5 flex items-center gap-1 text-[10px] font-semibold",
            isDown ? "text-amber-300" : "text-sky-300"
          )}
        >
          {isDown ? "↓" : "↑"} {Math.abs(delta).toFixed(1)} from {current.toFixed(current < 10 ? 1 : 0)}
        </div>
      ) : (
        <div className="mt-0.5 text-[10px] text-muted-foreground">no change</div>
      )}
    </div>
  );
}

function SourceChip({
  source,
}: {
  source: {
    id: string;
    type: "Historical" | "Recipe" | "Lag" | "Actuator";
    label: string;
    weight: number;
  };
}) {
  const iconMap = {
    Historical: <History className="h-3 w-3" />,
    Recipe: <Database className="h-3 w-3" />,
    Lag: <Clock className="h-3 w-3" />,
    Actuator: <Gauge className="h-3 w-3" />,
  } as const;
  const toneMap = {
    Historical: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    Recipe: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    Lag: "border-purple-500/30 bg-purple-500/10 text-purple-300",
    Actuator: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  } as const;
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-mono",
        toneMap[source.type]
      )}
      title={source.label}
    >
      {iconMap[source.type]}
      <span className="font-semibold">{source.id}</span>
      <span className="opacity-60">· {Math.round(source.weight * 100)}%</span>
    </span>
  );
}

/**
 * Formats a retrain timestamp as HH:MM:SS using a fixed locale-independent
 * format to avoid hydration mismatches from toLocaleTimeString.
 */
function formatRetrainTime(timestamp: number): string {
  const d = new Date(timestamp);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}
