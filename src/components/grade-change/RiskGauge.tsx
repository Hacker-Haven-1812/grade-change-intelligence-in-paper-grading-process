"use client";

import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Clock, Gauge as GaugeIcon, TrendingDown, TrendingUp } from "lucide-react";
import { useGradeChangeStore } from "@/hooks/useGradeChangeStore";
import { cn } from "@/lib/utils";

export function RiskGauge() {
  const risk = useGradeChangeStore((s) => s.recommendation.risk_prob);
  const pct = Math.round(risk * 100);

  const tone = risk > 0.6 ? "red" : risk > 0.35 ? "amber" : "emerald";
  const toneClass = {
    red: "text-red-400",
    amber: "text-amber-400",
    emerald: "text-emerald-400",
  }[tone];
  const ringColor = {
    red: "stroke-red-500",
    amber: "stroke-amber-500",
    emerald: "stroke-emerald-500",
  }[tone];
  const label = {
    red: "CRITICAL",
    amber: "WARNING",
    emerald: "STABLE",
  }[tone];

  // SVG arc geometry — 270° gauge from -135° to +135°
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const arcFraction = 0.75; // 270°
  const arcLength = circumference * arcFraction;
  const dashOffset = arcLength * (1 - risk);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="glass-panel relative flex flex-col items-center justify-center rounded-lg p-4 scanline"
    >
      <div className="absolute left-4 top-4 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        <AlertTriangle className="h-3 w-3" />
        Off-Spec Risk
      </div>
      <div className="absolute right-4 top-4 text-[10px] font-mono text-muted-foreground">
        ±2.5% BW
      </div>

      <div className="relative mt-4 grid place-items-center">
        <svg width="180" height="180" viewBox="0 0 180 180" className="-rotate-[135deg]">
          {/* Background track */}
          <circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            className="stroke-muted/30"
            strokeDasharray={`${arcLength} ${circumference}`}
          />
          {/* Risk arc */}
          <motion.circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            className={ringColor}
            strokeDasharray={`${arcLength} ${circumference}`}
            initial={{ strokeDashoffset: arcLength }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{ filter: "drop-shadow(0 0 6px currentColor)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-4xl font-bold tabular-nums", toneClass)}>
            {pct}
            <span className="text-lg">%</span>
          </span>
          <span className={cn("text-xs font-bold tracking-widest", toneClass)}>
            {label}
          </span>
        </div>
      </div>

      <p className="mt-2 max-w-[14rem] text-center text-[10px] leading-snug text-muted-foreground">
        Probability of Basis Weight deviation exceeding 2.5% in the next 30–60 s window
      </p>
    </motion.div>
  );
}

export function KPICards() {
  const rec = useGradeChangeStore((s) => s.recommendation);
  const inputs = useGradeChangeStore((s) => s.inputs);
  const current = useGradeChangeStore((s) => s.current);

  const stockDelta = rec.adjustments.suggested_stock_flow - inputs.stock_flow;
  const speedDelta = rec.adjustments.suggested_machine_speed - inputs.machine_speed;

  const cards = [
    {
      label: "Recommended Stock Flow",
      value: `${rec.adjustments.suggested_stock_flow.toFixed(1)}`,
      unit: "L/min",
      delta: stockDelta,
      icon: <TrendingDown className="h-4 w-4" />,
      tone: rec.risk_prob > 0.5 ? "amber" : "emerald",
    },
    {
      label: "Recommended Speed",
      value: `${rec.adjustments.suggested_machine_speed.toFixed(0)}`,
      unit: "m/min",
      delta: speedDelta,
      icon: <TrendingUp className="h-4 w-4" />,
      tone: "sky",
    },
    {
      label: "Stabilization ETA",
      value: `${rec.adjustments.est_stabilization_min}`,
      unit: "min",
      delta: null,
      icon: <Clock className="h-4 w-4" />,
      tone: "sky",
    },
    {
      label: "Current BW Deviation",
      value: `${current.deviation_pct.toFixed(2)}`,
      unit: "%",
      delta: current.is_off_spec ? 1 : -1,
      icon: <GaugeIcon className="h-4 w-4" />,
      tone: current.is_off_spec ? "red" : "emerald",
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {cards.map((c) => (
        <KPICard key={c.label} {...c} />
      ))}
    </div>
  );
}

function KPICard({
  label,
  value,
  unit,
  delta,
  icon,
  tone,
}: {
  label: string;
  value: string;
  unit: string;
  delta: number | null;
  icon: React.ReactNode;
  tone: "amber" | "emerald" | "red" | "sky";
}) {
  const toneMap = {
    amber: "text-amber-400 border-amber-500/30 bg-amber-500/5",
    emerald: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5",
    red: "text-red-400 border-red-500/30 bg-red-500/5",
    sky: "text-sky-400 border-sky-500/30 bg-sky-500/5",
  } as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel relative overflow-hidden rounded-lg p-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={cn("rounded p-1", toneMap[tone])}>{icon}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-mono text-2xl font-bold tabular-nums text-foreground">
          {value}
        </span>
        <span className="text-[10px] text-muted-foreground">{unit}</span>
      </div>
      {delta !== null && (
        <div
          className={cn(
            "mt-1 flex items-center gap-1 text-[10px] font-semibold",
            delta > 0 ? "text-amber-300" : delta < 0 ? "text-emerald-300" : "text-muted-foreground"
          )}
        >
          {delta > 0 ? (
            <TrendingUp className="h-3 w-3" />
          ) : delta < 0 ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : null}
          {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)} vs current
        </div>
      )}
    </motion.div>
  );
}
