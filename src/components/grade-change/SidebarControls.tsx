"use client";

import { motion } from "framer-motion";
import { Gauge, Settings2, Zap } from "lucide-react";
import {
  GRADE_SCENARIOS,
  FEATURE_META,
  type FeatureKey,
  type ProcessInputs,
} from "@/lib/gradeChangeEngine";
import { useGradeChangeStore } from "@/hooks/useGradeChangeStore";
import {
  Slider,
} from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const SLIDER_CONFIG: {
  key: FeatureKey;
  label: string;
  unit: string;
  step: number;
  icon: React.ReactNode;
}[] = [
  {
    key: "stock_flow",
    label: "Stock Flow",
    unit: "L/min",
    step: 1,
    icon: <Gauge className="h-3.5 w-3.5" />,
  },
  {
    key: "filler_flow",
    label: "Filler Flow",
    unit: "L/min",
    step: 0.5,
    icon: <Gauge className="h-3.5 w-3.5" />,
  },
  {
    key: "steam_pressure",
    label: "Steam Pressure",
    unit: "bar",
    step: 0.1,
    icon: <Zap className="h-3.5 w-3.5" />,
  },
  {
    key: "machine_speed",
    label: "Machine Speed",
    unit: "m/min",
    step: 5,
    icon: <Settings2 className="h-3.5 w-3.5" />,
  },
];

export function SidebarControls() {
  const inputs = useGradeChangeStore((s) => s.inputs);
  const setInput = useGradeChangeStore((s) => s.setInput);
  const applyInputs = useGradeChangeStore((s) => s.applyInputs);

  return (
    <aside className="flex w-full flex-col gap-4 lg:w-72 lg:shrink-0">
      {/* Operator Control Panel */}
      <section className="glass-panel rounded-lg p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-foreground">
            <Settings2 className="h-4 w-4 text-primary" />
            Machine Inputs
          </h2>
          <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
            OPERATOR
          </span>
        </div>

        <div className="space-y-5">
          {SLIDER_CONFIG.map((cfg) => {
            const [min, max] = FEATURE_META.ranges[cfg.key];
            const value = inputs[cfg.key];
            return (
              <div key={cfg.key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor={`slider-${cfg.key}`}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"
                  >
                    {cfg.icon}
                    {cfg.label}
                  </Label>
                  <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                    {value.toFixed(cfg.key === "steam_pressure" || cfg.key === "filler_flow" ? 1 : 0)}
                    <span className="ml-1 text-[10px] text-muted-foreground">{cfg.unit}</span>
                  </span>
                </div>
                <Slider
                  id={`slider-${cfg.key}`}
                  value={[value]}
                  min={min}
                  max={max}
                  step={cfg.step}
                  onValueChange={([v]) => setInput(cfg.key, v)}
                  className="[&_[role=slider]]:border-primary [&_[role=slider]]:bg-primary"
                />
                <div className="flex justify-between text-[9px] font-mono text-muted-foreground/70">
                  <span>{min}</span>
                  <span>{max}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Grade-change scenario presets */}
      <section className="glass-panel rounded-lg p-4">
        <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-foreground">
          <Zap className="h-4 w-4 text-primary" />
          Grade Scenarios
        </h2>
        <div className="space-y-2">
          {GRADE_SCENARIOS.map((s) => (
            <ScenarioButton
              key={s.id}
              scenario={s}
              active={false}
              onClick={() => applyInputs(s.inputs as ProcessInputs)}
            />
          ))}
        </div>
      </section>

      {/* Engine status footer */}
      <section className="glass-panel rounded-lg p-4">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-foreground">
          Engine Status
        </h2>
        <div className="space-y-2 font-mono text-[11px]">
          <StatusRow label="Model" value="RF · 100 trees" />
          <StatusRow label="AUC (val)" value="0.94" tone="emerald" />
          <StatusRow label="Lookahead" value="30–60 s" />
          <StatusRow label="Tick rate" value="1.5 s" />
          <StatusRow label="SHAP" value="TreeExplainer" />
        </div>
      </section>
    </aside>
  );
}

function ScenarioButton({
  scenario,
  active,
  onClick,
}: {
  scenario: (typeof GRADE_SCENARIOS)[number];
  active: boolean;
  onClick: () => void;
}) {
  const toneMap = {
    stable: "border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-500/60",
    warning: "border-amber-500/30 hover:bg-amber-500/10 hover:border-amber-500/60",
    critical: "border-red-500/30 hover:bg-red-500/10 hover:border-red-500/60",
  } as const;
  const dotMap = {
    stable: "bg-emerald-400",
    warning: "bg-amber-400",
    critical: "bg-red-400",
  } as const;

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "w-full rounded-md border bg-card/40 px-3 py-2 text-left transition-colors",
        toneMap[scenario.severity],
        active && "ring-1 ring-primary"
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", dotMap[scenario.severity])} />
        <span className="text-xs font-semibold text-foreground">{scenario.name}</span>
      </div>
      <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
        {scenario.description}
      </p>
    </motion.button>
  );
}

function StatusRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "amber" | "red";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "amber"
      ? "text-amber-300"
      : tone === "red"
      ? "text-red-300"
      : "text-foreground";
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={toneClass}>{value}</span>
    </div>
  );
}
