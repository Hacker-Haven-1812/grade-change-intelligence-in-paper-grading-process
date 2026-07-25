"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Brain, Grid3x3 } from "lucide-react";
import { computeShapValues, FEATURE_META } from "@/lib/gradeChangeEngine";
import { useGradeChangeStore } from "@/hooks/useGradeChangeStore";
import { cn } from "@/lib/utils";

export function ShapChart() {
  const inputs = useGradeChangeStore((s) => s.inputs);
  const shap = useMemo(() => computeShapValues(inputs), [inputs]);

  const maxAbs = Math.max(...shap.map((s) => Math.abs(s.value)), 0.01);

  return (
    <section className="glass-panel rounded-lg p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Brain className="h-4 w-4 text-primary" />
            SHAP Feature Attribution
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Per-feature contribution to off-spec risk · TreeExplainer
          </p>
        </div>
        <span className="rounded bg-primary/15 px-2 py-0.5 text-[10px] font-mono text-primary">
          SHAP v0.45
        </span>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={shap}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
            barCategoryGap={8}
          >
            <XAxis
              type="number"
              domain={[-maxAbs, maxAbs]}
              tick={{ fill: "oklch(0.65 0.01 250)", fontSize: 10, fontFamily: "monospace" }}
              tickLine={{ stroke: "oklch(0.32 0.02 250 / 50%)" }}
              axisLine={{ stroke: "oklch(0.32 0.02 250 / 50%)" }}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fill: "oklch(0.85 0.005 250)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={92}
            />
            <ReferenceLine x={0} stroke="oklch(0.5 0.01 250 / 60%)" />
            <Bar dataKey="value" radius={3} isAnimationActive={false}>
              {shap.map((entry, i) => (
                <Cell
                  key={`cell-${i}`}
                  fill={entry.value > 0 ? "#ef4444" : "#10b981"}
                  fillOpacity={0.3 + Math.min(0.7, Math.abs(entry.value) / maxAbs) * 0.7}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
        {shap.map((s) => (
          <div
            key={s.feature}
            className="flex items-center justify-between rounded bg-card/30 px-2 py-1 font-mono"
          >
            <span className="text-muted-foreground">{s.label}</span>
            <span
              className={cn(
                "font-semibold",
                s.value > 0 ? "text-red-300" : "text-emerald-300"
              )}
            >
              {s.value > 0 ? "+" : ""}
              {s.value.toFixed(3)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-red-500" /> pushes risk ↑
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-emerald-500" /> pushes risk ↓
        </span>
      </div>
    </section>
  );
}

export function CorrelationHeatmap() {
  const history = useGradeChangeStore((s) => s.history);

  const { keys, matrix } = useMemo(() => {
    // Re-derive a fresh correlation matrix from history
    const cols = ["stock_flow", "filler_flow", "steam_pressure", "machine_speed", "actual_bw"] as const;
    const n = history.length;
    const means: Record<string, number> = {};
    const stds: Record<string, number> = {};
    cols.forEach((c) => {
      const vals = history.map((h) => h[c as keyof typeof h] as number);
      const m = vals.reduce((s, x) => s + x, 0) / Math.max(1, n);
      const sd = Math.sqrt(vals.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, n));
      means[c] = m;
      stds[c] = sd;
    });
    const m: number[][] = [];
    for (let i = 0; i < cols.length; i++) {
      m.push([]);
      for (let j = 0; j < cols.length; j++) {
        if (stds[cols[i]] === 0 || stds[cols[j]] === 0) {
          m[i].push(0);
          continue;
        }
        let num = 0;
        for (let k = 0; k < n; k++) {
          num +=
            (history[k][cols[i] as keyof typeof history[0]] as number - means[cols[i]]) *
            (history[k][cols[j] as keyof typeof history[0]] as number - means[cols[j]]);
        }
        const r = num / (n * stds[cols[i]] * stds[cols[j]]);
        m[i].push(Math.round(r * 100) / 100);
      }
    }
    return { keys: cols as unknown as string[], matrix: m };
  }, [history]);

  const labels = ["Stock Flow", "Filler Flow", "Steam Press", "Speed", "Actual BW"];

  return (
    <section className="glass-panel rounded-lg p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Grid3x3 className="h-4 w-4 text-primary" />
            Dynamic Correlation Matrix
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Rolling cross-correlation across 90 s transition window
          </p>
        </div>
        <span className="rounded bg-primary/15 px-2 py-0.5 text-[10px] font-mono text-primary">
          Pearson r
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[280px]">
          {/* Column headers */}
          <div className="grid" style={{ gridTemplateColumns: `100px repeat(${labels.length}, 1fr)` }}>
            <div />
            {labels.map((l) => (
              <div
                key={l}
                className="px-1 pb-1 text-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {l}
              </div>
            ))}
          </div>
          {/* Rows */}
          {labels.map((rowLabel, i) => (
            <div
              key={rowLabel}
              className="grid items-center gap-1"
              style={{ gridTemplateColumns: `100px repeat(${labels.length}, 1fr)` }}
            >
              <div className="pr-2 text-right text-[10px] font-semibold text-muted-foreground">
                {rowLabel}
              </div>
              {matrix[i].map((v, j) => (
                <HeatmapCell key={`${i}-${j}`} value={v} diagonal={i === j} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span>-1</span>
          <div
            className="h-2 w-32 rounded"
            style={{
              background:
                "linear-gradient(90deg, #38bdf8 0%, #1e293b 50%, #f59e0b 100%)",
            }}
          />
          <span>+1</span>
        </div>
        <span className="font-mono">window: last 60 samples</span>
      </div>
    </section>
  );
}

function HeatmapCell({ value, diagonal }: { value: number; diagonal: boolean }) {
  // Map -1..+1 to a color: -1 = sky, 0 = dark slate, +1 = amber
  const intensity = Math.abs(value);
  const color =
    value > 0
      ? `rgba(245, 158, 11, ${0.12 + intensity * 0.65})`
      : value < 0
      ? `rgba(56, 189, 248, ${0.12 + intensity * 0.65})`
      : "rgba(30, 41, 59, 0.4)";

  const isStrong = intensity > 0.6 && !diagonal;

  return (
    <motion.div
      animate={{ backgroundColor: color }}
      transition={{ duration: 0.4 }}
      className={cn(
        "m-0.5 grid h-9 place-items-center rounded text-[10px] font-mono font-semibold tabular-nums",
        diagonal ? "text-muted-foreground" : isStrong ? "text-foreground" : "text-foreground/80"
      )}
      style={{ backgroundColor: color }}
    >
      {value.toFixed(2)}
    </motion.div>
  );
}
